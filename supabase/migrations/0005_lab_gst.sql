alter table sales add column if not exists gst_applied boolean not null default true;

create table lab_orders (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id), sale_id uuid not null references sales(id), sale_line_id uuid references sale_lines(id),
  customer_id uuid not null references customers(id), code text,
  status text not null default 'to_buy' check (status in ('to_buy','ordered','received','edging','fitting','qc','ready','delivered','cancelled')),
  lens_package_id uuid references lens_packages(id), lens_desc text not null, lens_details text, frame_desc text, frame_product_id uuid references products(id),
  rx_code text, od_sph numeric(4,2), od_cyl numeric(4,2), od_axis int, od_add numeric(4,2), os_sph numeric(4,2), os_cyl numeric(4,2), os_axis int, os_add numeric(4,2),
  pd_far numeric(4,1), pd_near numeric(4,1),
  supplier_name text, ordered_at timestamptz, received_at timestamptz, due_date date, priority text not null default 'normal' check (priority in ('normal','urgent')),
  assigned_to text, qc_note text, created_at timestamptz default now(), updated_at timestamptz default now(), unique (org_id, code));
create index on lab_orders (org_id, status); create index on lab_orders (sale_id);
create table lab_events (
  id bigserial primary key, org_id uuid not null default public.current_org() references organizations(id), lab_order_id uuid not null references lab_orders(id) on delete cascade,
  from_status text, to_status text not null, note text, by_user uuid default auth.uid(), at timestamptz default now());
create function lab_before() returns trigger language plpgsql security definer set search_path = public as $$
begin if tg_op = 'INSERT' then new.code := public.next_code(new.org_id, 'lab', 'LAB-'); else new.code := old.code; new.updated_at := now(); end if; return new; end $$;
create trigger trg_lab_before before insert or update on lab_orders for each row execute function lab_before();
create trigger trg_lab_audit after insert or update on lab_orders for each row execute function audit_row();
do $$ declare t text; begin
  foreach t in array array['lab_orders','lab_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (org_id = public.current_org())', t||'_s', t);
    execute format('create policy %I on %I for insert with check (org_id = public.current_org())', t||'_i', t);
  end loop;
  create policy lab_orders_u on lab_orders for update using (org_id = public.current_org()) with check (org_id = public.current_org());
end $$;

create or replace function place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_gst boolean := coalesce((select (value #>> '{}')::boolean from org_settings where org_id = public.current_org() and key = 'gst_enabled'), true);
  v_lead int := coalesce((select (value #>> '{}')::int from org_settings where org_id = public.current_org() and key = 'lab_lead_days'), 5);
  v_id uuid; v_code text; v_lid uuid; l jsonb; n int := 0; v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text; v_tot numeric;
  v_sub numeric := 0; v_dsc numeric := 0; v_taxinc numeric := 0; v_grand numeric := 0; v_lab boolean := false; v_pkind text;
  v_fdesc text; v_fpid uuid; v_pid uuid; v_have int; v_pkg lens_packages%rowtype; v_opts uuid[]; v_optsum numeric; v_optnames text;
  v_pay numeric := coalesce((p->'payment'->>'amount')::numeric, 0);
begin
  if v_org is null then raise exception 'Only approved staff can create sales'; end if;
  if v_kind not in ('quotation','order') then raise exception 'Unknown sale type'; end if;
  select role_key into v_role from profiles where id = auth.uid();
  v_maxdisc := coalesce((select (value #>> '{}')::numeric from org_settings where org_id = v_org and key = 'max_staff_discount_pct'), 10);
  if not exists (select 1 from customers where id = v_cust) then raise exception 'Choose a customer'; end if;
  if not exists (select 1 from branches where id = v_branch) then raise exception 'Choose a branch'; end if;
  if v_rx_id is not null then
    select to_jsonb(r) into v_rx from prescriptions r where r.id = v_rx_id and r.customer_id = v_cust;
    if v_rx is null then raise exception 'That prescription does not belong to this customer'; end if;
  end if;
  if v_qid is not null and not exists (select 1 from sales where id = v_qid and kind = 'quotation' and status in ('draft','sent')) then
    raise exception 'That quotation can no longer be converted'; end if;
  if jsonb_array_length(coalesce(p->'lines','[]'::jsonb)) = 0 then raise exception 'Add at least one item'; end if;

  insert into sales (branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id, status, notes, gst_applied, valid_until)
  values (v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, case when v_kind = 'quotation' then 'draft' else 'ready' end, nullif(p->>'notes',''), v_gst,
    case when v_kind = 'quotation' then coalesce((p->>'valid_until')::date,
      current_date + coalesce((select (value #>> '{}')::int from org_settings where org_id = v_org and key = 'quotation_valid_days'), 14)) end)
  returning id, code into v_id, v_code;

  for l in select * from jsonb_array_elements(p->'lines') loop
    n := n + 1; v_type := l->>'line_type'; v_pid := null; v_det := null; v_opts := '{}';
    v_qty := greatest(1, coalesce((l->>'qty')::int, 1)); v_disc := coalesce((l->>'discount_pct')::numeric, 0);
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100'; end if;
    if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin') then
      raise exception 'Discounts above % percent need an owner or admin', v_maxdisc; end if;
    if v_type = 'lens' then
      select * into v_pkg from lens_packages where id = (l->>'lens_package_id')::uuid and status = 'active';
      if not found then raise exception 'Choose a lens package'; end if;
      v_opts := array(select jsonb_array_elements_text(coalesce(l->'option_ids','[]'::jsonb))::uuid);
      select coalesce(sum(price),0), string_agg(name, ', ' order by display_order) into v_optsum, v_optnames from lens_options where id = any(v_opts) and status = 'active';
      v_unit := v_pkg.base_price + v_optsum; v_tax := v_pkg.tax_pct; v_desc := v_pkg.name || ' lenses'; v_det := v_optnames; v_lab := true;
    elsif v_type in ('product','accessory') then
      v_pid := (l->>'product_id')::uuid;
      select p2.selling_price, p2.tax_pct, trim(coalesce(b.name,'') || ' ' || p2.model), p2.kind into v_unit, v_tax, v_desc, v_pkind
        from products p2 left join brands b on b.id = p2.brand_id where p2.id = v_pid and p2.status = 'active';
      if v_unit is null then raise exception 'An item in the bag is no longer available'; end if;
      if v_pkind in ('frame','sunglass') then v_fdesc := v_desc; v_fpid := v_pid; end if;
      if v_kind = 'order' then
        select qty into v_have from stock where branch_id = v_branch and product_id = v_pid; v_have := coalesce(v_have, 0);
        if v_have < v_qty then raise exception 'Not enough stock for % (only % here)', v_desc, v_have; end if;
      end if;
    elsif v_type = 'service' then
      v_unit := (l->>'unit_price')::numeric; v_tax := coalesce((l->>'tax_pct')::numeric, 18); v_desc := nullif(trim(l->>'description'), '');
      if v_desc is null or v_unit is null or v_unit < 0 then raise exception 'Service items need a name and a price'; end if;
    else raise exception 'Unknown item type'; end if;
    if not v_gst then v_tax := 0; end if;   -- global GST switch is off: no tax on this document

    v_tot := round(v_qty * v_unit * (1 - v_disc / 100), 2);
    v_sub := v_sub + v_qty * v_unit; v_dsc := v_dsc + (v_qty * v_unit - v_tot); v_grand := v_grand + v_tot;
    v_taxinc := v_taxinc + (v_tot - round(v_tot / (1 + v_tax / 100), 2));
    insert into sale_lines (sale_id, line_no, line_type, product_id, lens_package_id, option_ids, description, details, qty, unit_price, discount_pct, tax_pct, line_total)
    values (v_id, n, v_type, v_pid, case when v_type = 'lens' then v_pkg.id end, v_opts, v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot) returning id into v_lid;
    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (branch_id, product_id, delta, reason, note) values (v_branch, v_pid, -v_qty, 'sale', v_code); end if;
    if v_kind = 'order' and v_type = 'lens' then   -- every lens line becomes a lab order carrying the customer's power
      insert into lab_orders (branch_id, sale_id, sale_line_id, customer_id, lens_package_id, lens_desc, lens_details, frame_desc, frame_product_id, rx_code,
        od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add, pd_far, pd_near, due_date)
      values (v_branch, v_id, v_lid, v_cust, v_pkg.id, v_desc, v_det, v_fdesc, v_fpid, v_rx->>'rx_code',
        (v_rx->>'od_sph')::numeric, (v_rx->>'od_cyl')::numeric, (v_rx->>'od_axis')::int, (v_rx->>'od_add')::numeric,
        (v_rx->>'os_sph')::numeric, (v_rx->>'os_cyl')::numeric, (v_rx->>'os_axis')::int, (v_rx->>'os_add')::numeric,
        (v_rx->>'pd_far')::numeric, (v_rx->>'pd_near')::numeric, current_date + v_lead);
    end if;
  end loop;

  if v_kind = 'order' and v_lab and v_rx is null then raise exception 'Lens orders need a prescription. Choose one, or add a new prescription first.'; end if;
  update sales set subtotal = v_sub, discount_total = v_dsc, tax_included = v_taxinc, grand_total = v_grand, needs_lab = v_lab,
    status = case when v_kind = 'quotation' then 'draft' when v_lab then 'lab_pending' else 'ready' end where id = v_id;
  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (sale_id, amount, method, reference) values (v_id, v_pay, coalesce(p->'payment'->>'method','cash'), nullif(p->'payment'->>'reference','')); end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function cancel_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; r record;
begin
  select * into s from sales where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status not in ('lab_pending','ready') then raise exception 'This order is already in production, delivered or cancelled'; end if;
  if exists (select 1 from lab_orders where sale_id = p_id and status not in ('to_buy','cancelled')) then raise exception 'Lenses were already bought for this order, so it cannot be cancelled'; end if;
  if s.paid_total > 0 then raise exception 'Refund the payments before cancelling (refunds arrive with Finance)'; end if;
  for r in select product_id, qty from sale_lines where sale_id = p_id and product_id is not null loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (s.org_id, s.branch_id, r.product_id, r.qty, 'return', s.code || ' cancelled'); end loop;
  update lab_orders set status = 'cancelled' where sale_id = p_id;
  update sales set status = 'cancelled' where id = p_id;
end $$;

create or replace function deliver_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s sales%rowtype;
begin
  select * into s from sales where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status <> 'ready' then raise exception 'Only orders marked ready can be delivered'; end if;
  if s.paid_total < s.grand_total then raise exception 'Collect the balance of % first', s.grand_total - s.paid_total; end if;
  update lab_orders set status = 'delivered' where sale_id = p_id and status = 'ready';
  update sales set status = 'delivered' where id = p_id;
end $$;

-- Moves one or many lab orders one legal step; keeps the order status in sync and writes the timeline.
create function advance_lab_orders(p_ids uuid[], p_to text, p_note text default null, p_supplier text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r lab_orders%rowtype; m int;
begin
  if public.current_org() is null then raise exception 'Only approved staff can update lab orders'; end if;
  for r in select * from lab_orders where id = any(p_ids) and org_id = public.current_org() for update loop
    if not ((r.status, p_to) in (('to_buy','ordered'),('ordered','received'),('received','edging'),('edging','fitting'),('fitting','qc'),('qc','ready'),('qc','fitting'))) then
      raise exception '% cannot move from % to %', r.code, r.status, p_to; end if;
    if p_to = 'ordered' and coalesce(nullif(trim(p_supplier),''), r.supplier_name) is null then raise exception 'Enter the supplier name'; end if;
    if r.status = 'qc' and p_to = 'fitting' and coalesce(trim(p_note),'') = '' then raise exception 'Describe what needs rework'; end if;
    update lab_orders set status = p_to,
      supplier_name = case when p_to = 'ordered' then coalesce(nullif(trim(p_supplier),''), supplier_name) else supplier_name end,
      ordered_at = case when p_to = 'ordered' then now() else ordered_at end, received_at = case when p_to = 'received' then now() else received_at end,
      qc_note = case when r.status = 'qc' and p_to = 'fitting' then p_note else qc_note end where id = r.id;
    insert into lab_events (org_id, lab_order_id, from_status, to_status, note) values (r.org_id, r.id, r.status, p_to, nullif(trim(p_note),''));
    select min(case status when 'to_buy' then 1 when 'ordered' then 2 when 'received' then 3 when 'edging' then 4 when 'fitting' then 5 when 'qc' then 6 else 7 end)
      into m from lab_orders where sale_id = r.sale_id and status not in ('cancelled','delivered');
    update sales set status = case when m = 7 then 'ready' when m = 6 then 'qc' when m >= 4 then 'in_workshop' else 'lab_pending' end
      where id = r.sale_id and status in ('lab_pending','in_workshop','qc','ready');
  end loop;
end $$;
