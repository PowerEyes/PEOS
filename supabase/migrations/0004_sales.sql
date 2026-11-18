create function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and is_approved and role_key in ('owner','admin')) $$;

create table org_settings (org_id uuid not null default public.current_org() references organizations(id), key text not null, value jsonb not null, primary key (org_id, key));
alter table org_settings enable row level security;
create policy org_settings_s on org_settings for select using (org_id = public.current_org());
create policy org_settings_i on org_settings for insert with check (org_id = public.current_org() and public.is_admin());
create policy org_settings_u on org_settings for update using (org_id = public.current_org() and public.is_admin());

-- Lens index and add-ons, editable in PowerOS, read by the POS and (later) the website lens wizard
create table lens_options (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  grp text not null check (grp in ('index','addon')), code text not null, name text not null, description text,
  price numeric(10,2) not null default 0, tax_pct numeric(4,1) not null default 5, badge text,
  designs text[] not null default '{}',  -- empty = applies to every lens design
  status text not null default 'active' check (status in ('active','draft','inactive')), display_order int not null default 0,
  unique (org_id, code));
create trigger trg_lens_options_audit after insert or update or delete on lens_options for each row execute function audit_row();

create table sales (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id), kind text not null check (kind in ('quotation','order')), code text,
  customer_id uuid not null references customers(id), prescription_id uuid references prescriptions(id), rx_snapshot jsonb,
  source_quotation_id uuid references sales(id),
  status text not null check (status in ('draft','sent','converted','rejected','lab_pending','in_workshop','qc','ready','delivered','cancelled')),
  subtotal numeric(12,2) not null default 0, discount_total numeric(12,2) not null default 0, tax_included numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0, paid_total numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  needs_lab boolean not null default false, valid_until date, notes text, salesperson uuid default auth.uid(),
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (org_id, code));
create index on sales (org_id, kind, created_at desc); create index on sales (org_id, customer_id);
create table sale_lines (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  sale_id uuid not null references sales(id) on delete cascade, line_no int not null,
  line_type text not null check (line_type in ('product','accessory','lens','service')),
  product_id uuid references products(id), lens_package_id uuid references lens_packages(id), option_ids uuid[] not null default '{}',
  description text not null, details text, qty int not null check (qty > 0), unit_price numeric(12,2) not null,
  discount_pct numeric(5,2) not null default 0, tax_pct numeric(4,1) not null default 0, line_total numeric(12,2) not null);
create table payments (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  sale_id uuid not null references sales(id), amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','upi','card','bank','razorpay')), reference text,
  created_by uuid default auth.uid(), created_at timestamptz default now());

create function sales_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.code := public.next_code(new.org_id, 'sale_' || new.kind, case new.kind when 'quotation' then 'Q-' else 'ORD-' end);
  else new.code := old.code; new.updated_at := now(); end if;
  return new;
end $$;
create trigger trg_sales_before before insert or update on sales for each row execute function sales_before();
create trigger trg_sales_audit after insert or update on sales for each row execute function audit_row();
create trigger trg_payments_audit after insert on payments for each row execute function audit_row();

create function payments_apply() returns trigger language plpgsql security definer set search_path = public as $$
declare s sales%rowtype;
begin
  select * into s from sales where id = new.sale_id for update;
  if s.kind <> 'order' then raise exception 'Payments can only be taken on orders'; end if;
  if s.status = 'cancelled' then raise exception 'This order is cancelled'; end if;
  if s.paid_total + new.amount > s.grand_total then raise exception 'That is more than the balance due'; end if;
  update sales set paid_total = s.paid_total + new.amount,
    payment_status = case when s.paid_total + new.amount >= s.grand_total then 'paid' else 'partial' end where id = s.id;
  return new;
end $$;
create trigger trg_payments_apply after insert on payments for each row execute function payments_apply();

do $$ declare t text; begin
  foreach t in array array['lens_options','sales','sale_lines','payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (org_id = public.current_org())', t||'_s', t);
    execute format('create policy %I on %I for insert with check (org_id = public.current_org())', t||'_i', t);
  end loop;
  foreach t in array array['lens_options','sales'] loop
    execute format('create policy %I on %I for update using (org_id = public.current_org()) with check (org_id = public.current_org())', t||'_u', t);
  end loop;
end $$;

-- One atomic call: header + lines + stock + first payment. Prices come from the database, never the browser.
create function place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_id uuid; v_code text; l jsonb; n int := 0; v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text; v_tot numeric;
  v_sub numeric := 0; v_dsc numeric := 0; v_taxinc numeric := 0; v_grand numeric := 0; v_lab boolean := false;
  v_pid uuid; v_have int; v_pkg lens_packages%rowtype; v_opts uuid[]; v_optsum numeric; v_optnames text;
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

  insert into sales (branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id, status, notes, valid_until)
  values (v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, case when v_kind = 'quotation' then 'draft' else 'ready' end, nullif(p->>'notes',''),
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
      select p2.selling_price, p2.tax_pct, trim(coalesce(b.name,'') || ' ' || p2.model) into v_unit, v_tax, v_desc
        from products p2 left join brands b on b.id = p2.brand_id where p2.id = v_pid and p2.status = 'active';
      if v_unit is null then raise exception 'An item in the bag is no longer available'; end if;
      if v_kind = 'order' then
        select qty into v_have from stock where branch_id = v_branch and product_id = v_pid; v_have := coalesce(v_have, 0);
        if v_have < v_qty then raise exception 'Not enough stock for % (only % here)', v_desc, v_have; end if;
      end if;
    elsif v_type = 'service' then
      v_unit := (l->>'unit_price')::numeric; v_tax := coalesce((l->>'tax_pct')::numeric, 18); v_desc := nullif(trim(l->>'description'), '');
      if v_desc is null or v_unit is null or v_unit < 0 then raise exception 'Service items need a name and a price'; end if;
    else raise exception 'Unknown item type'; end if;

    v_tot := round(v_qty * v_unit * (1 - v_disc / 100), 2);
    v_sub := v_sub + v_qty * v_unit; v_dsc := v_dsc + (v_qty * v_unit - v_tot); v_grand := v_grand + v_tot;
    v_taxinc := v_taxinc + (v_tot - round(v_tot / (1 + v_tax / 100), 2));
    insert into sale_lines (sale_id, line_no, line_type, product_id, lens_package_id, option_ids, description, details, qty, unit_price, discount_pct, tax_pct, line_total)
    values (v_id, n, v_type, v_pid, case when v_type = 'lens' then v_pkg.id end, v_opts, v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot);
    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (branch_id, product_id, delta, reason, note) values (v_branch, v_pid, -v_qty, 'sale', v_code); end if;
  end loop;

  if v_kind = 'order' and v_lab and v_rx is null then raise exception 'Lens orders need a prescription. Choose one, or add a new prescription first.'; end if;
  update sales set subtotal = v_sub, discount_total = v_dsc, tax_included = v_taxinc, grand_total = v_grand, needs_lab = v_lab,
    status = case when v_kind = 'quotation' then 'draft' when v_lab then 'lab_pending' else 'ready' end where id = v_id;
  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (sale_id, amount, method, reference) values (v_id, v_pay, coalesce(p->'payment'->>'method','cash'), nullif(p->'payment'->>'reference','')); end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

create function cancel_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; r record;
begin
  select * into s from sales where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status not in ('lab_pending','ready') then raise exception 'This order is already in production, delivered or cancelled'; end if;
  if s.paid_total > 0 then raise exception 'Refund the payments before cancelling (refunds arrive with Finance)'; end if;
  for r in select product_id, qty from sale_lines where sale_id = p_id and product_id is not null loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (s.org_id, s.branch_id, r.product_id, r.qty, 'return', s.code || ' cancelled'); end loop;
  update sales set status = 'cancelled' where id = p_id;
end $$;

create function deliver_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s sales%rowtype;
begin
  select * into s from sales where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status <> 'ready' then raise exception 'Only orders marked ready can be delivered'; end if;
  if s.paid_total < s.grand_total then raise exception 'Collect the balance of % first', s.grand_total - s.paid_total; end if;
  update sales set status = 'delivered' where id = p_id;
end $$;
