-- ─── 1. Product-level GST fields ───────────────────────────────────────────
alter table products
  add column if not exists hsn text,
  add column if not exists price_mode text not null default 'inclusive' check (price_mode in ('inclusive','exclusive'));

-- ─── 2. Sale-line GST snapshot (so old invoices are never altered) ──────────
alter table sale_lines
  add column if not exists hsn text,
  add column if not exists price_mode text not null default 'inclusive',
  add column if not exists taxable_value numeric(12,2) not null default 0,
  add column if not exists cgst_pct numeric(5,2) not null default 0,
  add column if not exists cgst_amt numeric(12,2) not null default 0,
  add column if not exists sgst_pct numeric(5,2) not null default 0,
  add column if not exists sgst_amt numeric(12,2) not null default 0,
  add column if not exists igst_pct numeric(5,2) not null default 0,
  add column if not exists igst_amt numeric(12,2) not null default 0;

-- ─── 3. Sale-header GST totals ──────────────────────────────────────────────
alter table sales
  add column if not exists supply_type text not null default 'intrastate' check (supply_type in ('intrastate','interstate')),
  add column if not exists state_of_supply text not null default 'Tamil Nadu',
  add column if not exists recipient_gstin text,
  add column if not exists taxable_total numeric(12,2) not null default 0,
  add column if not exists cgst_total numeric(12,2) not null default 0,
  add column if not exists sgst_total numeric(12,2) not null default 0,
  add column if not exists igst_total numeric(12,2) not null default 0;

-- ─── 4. Suppliers ───────────────────────────────────────────────────────────
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  name text not null, gstin text, phone text, email text, address text,
  state text not null default 'Tamil Nadu',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(), unique (org_id, name));

-- ─── 5. Purchase invoices (for ITC tracking) ────────────────────────────────
create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  supplier_id uuid references suppliers(id),
  supplier_name text not null, supplier_gstin text,
  invoice_no text not null, invoice_date date not null,
  supply_type text not null default 'intrastate' check (supply_type in ('intrastate','interstate')),
  subtotal numeric(12,2) not null default 0, tax_total numeric(12,2) not null default 0, grand_total numeric(12,2) not null default 0,
  cgst_total numeric(12,2) not null default 0, sgst_total numeric(12,2) not null default 0, igst_total numeric(12,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','paid')), paid_on date,
  notes text, created_at timestamptz default now(), unique (org_id, supplier_id, invoice_no));

create table purchase_items (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  purchase_id uuid not null references purchase_invoices(id) on delete cascade,
  description text not null, hsn text, qty int not null default 1, unit_price numeric(12,2) not null,
  tax_pct numeric(4,1) not null default 18, taxable_value numeric(12,2) not null default 0,
  cgst_amt numeric(12,2) not null default 0, sgst_amt numeric(12,2) not null default 0, igst_amt numeric(12,2) not null default 0, line_total numeric(12,2) not null);

-- ─── 6. Expenses ────────────────────────────────────────────────────────────
create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  category text not null, description text not null, amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date, payment_method text not null default 'cash' check (payment_method in ('cash','upi','card','bank')),
  reference text, receipt_path text, approved_by uuid, created_by uuid default auth.uid(), created_at timestamptz default now());
create index on expenses (org_id, expense_date desc);

-- ─── 7. Credit notes (returns, reversals) ──────────────────────────────────
create table credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  code text, original_sale_id uuid not null references sales(id),
  customer_id uuid not null references customers(id),
  reason text not null, refund_method text check (refund_method in ('cash','upi','card','bank','store_credit')),
  subtotal numeric(12,2) not null default 0, cgst_total numeric(12,2) not null default 0,
  sgst_total numeric(12,2) not null default 0, igst_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0, status text not null default 'issued' check (status in ('issued','refunded')),
  created_by uuid default auth.uid(), created_at timestamptz default now(), unique (org_id, code));
create table credit_note_lines (
  id uuid primary key default gen_random_uuid(), org_id uuid not null default public.current_org() references organizations(id),
  credit_note_id uuid not null references credit_notes(id) on delete cascade,
  original_line_id uuid references sale_lines(id),
  description text not null, qty int not null check (qty > 0), unit_price numeric(12,2) not null,
  taxable_value numeric(12,2) not null default 0, cgst_pct numeric(5,2) not null default 0,
  cgst_amt numeric(12,2) not null default 0, sgst_pct numeric(5,2) not null default 0,
  sgst_amt numeric(12,2) not null default 0, igst_pct numeric(5,2) not null default 0,
  igst_amt numeric(12,2) not null default 0, line_total numeric(12,2) not null);

create function credit_notes_before() returns trigger language plpgsql security definer set search_path = public as $$
begin new.code := public.next_code(new.org_id,'credit_note','CN-'); return new; end $$;
create trigger trg_cn_before before insert on credit_notes for each row execute function credit_notes_before();

-- ─── 8. Day closings ────────────────────────────────────────────────────────
create table day_closings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  closing_date date not null, opening_cash numeric(12,2) not null default 0,
  actual_cash numeric(12,2) not null, expected_cash numeric(12,2) not null default 0,
  cash_difference numeric(12,2) not null default 0,
  cash_sales numeric(12,2) not null default 0, upi_sales numeric(12,2) not null default 0,
  card_sales numeric(12,2) not null default 0, bank_sales numeric(12,2) not null default 0,
  total_sales numeric(12,2) not null default 0, order_count int not null default 0,
  notes text, closed_by uuid default auth.uid(), created_at timestamptz default now(),
  unique (org_id, branch_id, closing_date));

-- ─── 9. GST periods ─────────────────────────────────────────────────────────
create table gst_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  period_year int not null, period_month int not null check (period_month between 1 and 12),
  status text not null default 'open' check (status in ('open','closed')),
  output_cgst numeric(12,2), output_sgst numeric(12,2), output_igst numeric(12,2),
  input_cgst numeric(12,2), input_sgst numeric(12,2), input_igst numeric(12,2),
  net_liability numeric(12,2), closed_by uuid, closed_at timestamptz, created_at timestamptz default now(),
  unique (org_id, period_year, period_month));

-- ─── 10. RLS ────────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['suppliers','purchase_invoices','purchase_items','expenses','credit_notes','credit_note_lines','day_closings','gst_periods'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (org_id = public.current_org())', t||'_s', t);
    execute format('create policy %I on %I for insert with check (org_id = public.current_org())', t||'_i', t);
  end loop;
  foreach t in array array['purchase_invoices','expenses','credit_notes','day_closings'] loop
    execute format('create policy %I on %I for update using (org_id = public.current_org())', t||'_u', t);
  end loop;
end $$;

-- ─── 11. Rewrite place_sale with proper GST split ───────────────────────────
create or replace function place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_gst boolean := coalesce((select (value #>> '{}')::boolean from org_settings where org_id = public.current_org() and key = 'gst_enabled'), true);
  v_gstin text := coalesce((select (value #>> '{}') from org_settings where org_id = public.current_org() and key = 'gstin'), '');
  v_lead int := coalesce((select (value #>> '{}')::int from org_settings where org_id = public.current_org() and key = 'lab_lead_days'), 5);
  v_supply_type text := coalesce(nullif(p->>'supply_type',''), 'intrastate');
  v_state_of_supply text := coalesce(nullif(p->>'state_of_supply',''), 'Tamil Nadu');
  v_recipient_gstin text := nullif(trim(coalesce(p->>'recipient_gstin','')), '');
  v_id uuid; v_code text; v_lid uuid; l jsonb; n int := 0;
  v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text;
  v_hsn text; v_pmode text;
  v_taxable numeric; v_tax_amt numeric; v_cgst_p numeric; v_sgst_p numeric; v_igst_p numeric;
  v_cgst_a numeric; v_sgst_a numeric; v_igst_a numeric; v_tot numeric;
  v_sub numeric := 0; v_dsc numeric := 0; v_taxable_tot numeric := 0;
  v_cgst_tot numeric := 0; v_sgst_tot numeric := 0; v_igst_tot numeric := 0; v_grand numeric := 0;
  v_lab boolean := false; v_pkind text; v_fdesc text; v_fpid uuid;
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

  insert into sales (branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id, status, notes, gst_applied, supply_type, state_of_supply, recipient_gstin, valid_until)
  values (v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, 'draft', nullif(p->>'notes',''), v_gst, v_supply_type, v_state_of_supply, v_recipient_gstin,
    case when v_kind = 'quotation' then coalesce((p->>'valid_until')::date, current_date + coalesce((select (value #>> '{}')::int from org_settings where org_id = v_org and key = 'quotation_valid_days'), 14)) end)
  returning id, code into v_id, v_code;

  for l in select * from jsonb_array_elements(p->'lines') loop
    n := n + 1; v_type := l->>'line_type'; v_pid := null; v_det := null; v_opts := '{}';
    v_hsn := null; v_pmode := 'inclusive';
    v_qty := greatest(1, coalesce((l->>'qty')::int, 1)); v_disc := coalesce((l->>'discount_pct')::numeric, 0);
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100'; end if;
    if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin') then
      raise exception 'Discounts above % percent need an owner or admin', v_maxdisc; end if;

    if v_type = 'lens' then
      select * into v_pkg from lens_packages where id = (l->>'lens_package_id')::uuid and status = 'active';
      if not found then raise exception 'Choose a lens package'; end if;
      v_opts := array(select jsonb_array_elements_text(coalesce(l->'option_ids','[]'::jsonb))::uuid);
      select coalesce(sum(price),0), string_agg(name, ', ' order by display_order) into v_optsum, v_optnames from lens_options where id = any(v_opts) and status = 'active';
      v_unit := v_pkg.base_price + v_optsum; v_tax := v_pkg.tax_pct; v_desc := v_pkg.name || ' lenses'; v_det := v_optnames;
      v_hsn := '900150'; v_pmode := 'inclusive'; v_lab := true;
    elsif v_type in ('product','accessory') then
      v_pid := (l->>'product_id')::uuid;
      select p2.selling_price, p2.tax_pct, trim(coalesce(b.name,'') || ' ' || p2.model), p2.kind, coalesce(p2.hsn,''), p2.price_mode
        into v_unit, v_tax, v_desc, v_pkind, v_hsn, v_pmode
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
      v_hsn := '999999'; v_pmode := 'exclusive';
    else raise exception 'Unknown item type'; end if;

    if not v_gst then v_tax := 0; end if;

    -- Calculate totals based on price mode
    if v_pmode = 'exclusive' then
      v_taxable := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_tax_amt := round(v_taxable * v_tax / 100, 2);
      v_tot := v_taxable + v_tax_amt;
    else -- inclusive
      v_tot := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_taxable := case when v_tax > 0 then round(v_tot / (1 + v_tax/100), 2) else v_tot end;
      v_tax_amt := v_tot - v_taxable;
    end if;

    -- Split CGST/SGST vs IGST
    if v_gst and v_supply_type = 'intrastate' then
      v_cgst_p := v_tax/2; v_sgst_p := v_tax/2; v_igst_p := 0;
      v_cgst_a := round(v_tax_amt/2, 2); v_sgst_a := v_tax_amt - round(v_tax_amt/2, 2); v_igst_a := 0;
    elsif v_gst then
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := v_tax;
      v_cgst_a := 0; v_sgst_a := 0; v_igst_a := v_tax_amt;
    else
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := 0; v_cgst_a := 0; v_sgst_a := 0; v_igst_a := 0;
    end if;

    v_sub := v_sub + v_qty * v_unit;
    v_dsc := v_dsc + (v_qty * v_unit * (1 - v_disc/100) - v_taxable - v_tax_amt);
    v_taxable_tot := v_taxable_tot + v_taxable;
    v_cgst_tot := v_cgst_tot + v_cgst_a; v_sgst_tot := v_sgst_tot + v_sgst_a; v_igst_tot := v_igst_tot + v_igst_a;
    v_grand := v_grand + v_tot;

    insert into sale_lines (sale_id, line_no, line_type, product_id, lens_package_id, option_ids, description, details, qty, unit_price, discount_pct, tax_pct, line_total,
      hsn, price_mode, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt)
    values (v_id, n, v_type, v_pid, case when v_type='lens' then v_pkg.id end, v_opts, v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot,
      v_hsn, v_pmode, v_taxable, v_cgst_p, v_cgst_a, v_sgst_p, v_sgst_a, v_igst_p, v_igst_a) returning id into v_lid;

    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (branch_id, product_id, delta, reason, note) values (v_branch, v_pid, -v_qty, 'sale', v_code); end if;
    if v_kind = 'order' and v_type = 'lens' then
      insert into lab_orders (branch_id, sale_id, sale_line_id, customer_id, lens_package_id, lens_desc, lens_details, frame_desc, frame_product_id, rx_code,
        od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add, pd_far, pd_near, due_date)
      values (v_branch, v_id, v_lid, v_cust, v_pkg.id, v_desc, v_det, v_fdesc, v_fpid, v_rx->>'rx_code',
        (v_rx->>'od_sph')::numeric, (v_rx->>'od_cyl')::numeric, (v_rx->>'od_axis')::int, (v_rx->>'od_add')::numeric,
        (v_rx->>'os_sph')::numeric, (v_rx->>'os_cyl')::numeric, (v_rx->>'os_axis')::int, (v_rx->>'os_add')::numeric,
        (v_rx->>'pd_far')::numeric, (v_rx->>'pd_near')::numeric, current_date + v_lead); end if;
  end loop;

  if v_kind = 'order' and v_lab and v_rx is null then raise exception 'Lens orders need a prescription.'; end if;
  update sales set subtotal = v_sub, discount_total = greatest(0, v_dsc), tax_included = v_cgst_tot + v_sgst_tot + v_igst_tot,
    grand_total = v_grand, taxable_total = v_taxable_tot,
    cgst_total = v_cgst_tot, sgst_total = v_sgst_tot, igst_total = v_igst_tot, needs_lab = v_lab,
    status = case when v_kind='quotation' then 'draft' when v_lab then 'lab_pending' else 'ready' end where id = v_id;
  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (sale_id, amount, method, reference) values (v_id, v_pay, coalesce(p->'payment'->>'method','cash'), nullif(p->'payment'->>'reference','')); end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- ─── 12. Create credit note ──────────────────────────────────────────────────
create function create_credit_note(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org(); v_sale sales%rowtype; v_cn_id uuid; v_cn_code text;
  l jsonb; v_orig sale_lines%rowtype;
  v_sub numeric := 0; v_cg numeric := 0; v_sg numeric := 0; v_ig numeric := 0; v_total numeric := 0; v_rqty int;
begin
  if v_org is null then raise exception 'Only approved staff can issue credit notes'; end if;
  select * into v_sale from sales where id = (p->>'sale_id')::uuid and org_id = v_org;
  if not found then raise exception 'Order not found'; end if;
  if v_sale.status in ('cancelled') then raise exception 'Cannot return a cancelled order'; end if;
  insert into credit_notes (branch_id, original_sale_id, customer_id, reason, refund_method)
  values (v_sale.branch_id, v_sale.id, v_sale.customer_id, coalesce(nullif(trim(p->>'reason'),''), 'Customer return'), nullif(p->>'refund_method',''))
  returning id, code into v_cn_id, v_cn_code;
  for l in select * from jsonb_array_elements(p->'lines') loop
    select * into v_orig from sale_lines where id = (l->>'line_id')::uuid and sale_id = v_sale.id;
    if not found then raise exception 'Line not found on this order'; end if;
    v_rqty := least(greatest(1, (l->>'qty')::int), v_orig.qty);
    declare v_taxable numeric := round(v_orig.taxable_value / v_orig.qty * v_rqty, 2);
        v_cg_a numeric := round(v_orig.cgst_amt / v_orig.qty * v_rqty, 2);
        v_sg_a numeric := round(v_orig.sgst_amt / v_orig.qty * v_rqty, 2);
        v_ig_a numeric := round(v_orig.igst_amt / v_orig.qty * v_rqty, 2);
        v_lt numeric := round(v_orig.line_total / v_orig.qty * v_rqty, 2);
    begin
      insert into credit_note_lines (credit_note_id, original_line_id, description, qty, unit_price, taxable_value,
        cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, line_total)
      values (v_cn_id, v_orig.id, v_orig.description, v_rqty, v_orig.unit_price, v_taxable,
        v_orig.cgst_pct, v_cg_a, v_orig.sgst_pct, v_sg_a, v_orig.igst_pct, v_ig_a, v_lt);
      v_sub := v_sub + v_taxable; v_cg := v_cg + v_cg_a; v_sg := v_sg + v_sg_a; v_ig := v_ig + v_ig_a; v_total := v_total + v_lt;
      if v_orig.product_id is not null then
        insert into stock_movements (branch_id, product_id, delta, reason, note)
        values (v_sale.branch_id, v_orig.product_id, v_rqty, 'return', v_cn_code); end if;
    end;
  end loop;
  update credit_notes set subtotal = v_sub, cgst_total = v_cg, sgst_total = v_sg, igst_total = v_ig, grand_total = v_total where id = v_cn_id;
  return jsonb_build_object('id', v_cn_id, 'code', v_cn_code);
end $$;

alter table suppliers enable row level security;
create policy suppliers_s on suppliers for select using (org_id = public.current_org());
create policy suppliers_i on suppliers for insert with check (org_id = public.current_org());
create policy suppliers_u on suppliers for update using (org_id = public.current_org());
