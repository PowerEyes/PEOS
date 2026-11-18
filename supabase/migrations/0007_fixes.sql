-- ── Fix 1: place_sale v_dsc per-line formula was wrong ──────────────────────
-- Old formula gave 0 for inclusive pricing and negative for exclusive.
-- Fix: compute discount_total = subtotal - grand_total at the end, not per line.
create or replace function place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_gst boolean := coalesce((select (value #>> '{}')::boolean from org_settings where org_id = public.current_org() and key = 'gst_enabled'), true);
  v_lead int := coalesce((select (value #>> '{}')::int from org_settings where org_id = public.current_org() and key = 'lab_lead_days'), 5);
  v_supply_type text := coalesce(nullif(p->>'supply_type',''), 'intrastate');
  v_state_of_supply text := coalesce(nullif(p->>'state_of_supply',''), 'Tamil Nadu');
  v_recipient_gstin text := nullif(trim(coalesce(p->>'recipient_gstin','')), '');
  v_id uuid; v_code text; v_lid uuid; l jsonb; n int := 0;
  v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text;
  v_hsn text; v_pmode text;
  v_taxable numeric; v_tax_amt numeric; v_cgst_p numeric; v_sgst_p numeric; v_igst_p numeric;
  v_cgst_a numeric; v_sgst_a numeric; v_igst_a numeric; v_tot numeric;
  -- subtotal = sum of listed prices (before discount), always inclusive-of-tax
  -- grand_total = sum of actual amounts paid
  v_sub numeric := 0; v_grand numeric := 0; v_taxable_tot numeric := 0;
  v_cgst_tot numeric := 0; v_sgst_tot numeric := 0; v_igst_tot numeric := 0;
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
  if v_qid is not null and not exists (select 1 from sales where id = v_qid and kind = 'quotation' and status in ('draft','sent'))
    then raise exception 'That quotation can no longer be converted'; end if;
  if jsonb_array_length(coalesce(p->'lines','[]'::jsonb)) = 0 then raise exception 'Add at least one item'; end if;

  insert into sales (branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id,
    status, notes, gst_applied, supply_type, state_of_supply, recipient_gstin, valid_until)
  values (v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, 'draft', nullif(p->>'notes',''),
    v_gst, v_supply_type, v_state_of_supply, v_recipient_gstin,
    case when v_kind = 'quotation' then coalesce((p->>'valid_until')::date,
      current_date + coalesce((select (value #>> '{}')::int from org_settings where org_id = v_org and key = 'quotation_valid_days'), 14)) end)
  returning id, code into v_id, v_code;

  for l in select * from jsonb_array_elements(p->'lines') loop
    n := n + 1; v_type := l->>'line_type'; v_pid := null; v_det := null; v_opts := '{}';
    v_hsn := null; v_pmode := 'inclusive';
    v_qty := greatest(1, coalesce((l->>'qty')::int, 1));
    v_disc := coalesce((l->>'discount_pct')::numeric, 0);
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be 0–100'; end if;
    if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin')
      then raise exception 'Discounts above %% need an owner or admin', v_maxdisc; end if;

    if v_type = 'lens' then
      select * into v_pkg from lens_packages where id = (l->>'lens_package_id')::uuid and status = 'active';
      if not found then raise exception 'Choose an active lens package'; end if;
      v_opts := array(select jsonb_array_elements_text(coalesce(l->'option_ids','[]'::jsonb))::uuid);
      select coalesce(sum(price),0), string_agg(name, ', ' order by display_order)
        into v_optsum, v_optnames from lens_options where id = any(v_opts) and status = 'active';
      v_unit := v_pkg.base_price + v_optsum; v_tax := v_pkg.tax_pct;
      v_desc := v_pkg.name || ' lenses'; v_det := v_optnames;
      v_hsn := '900150'; v_pmode := 'inclusive'; v_lab := true;

    elsif v_type in ('product','accessory') then
      v_pid := (l->>'product_id')::uuid;
      select p2.selling_price, p2.tax_pct, trim(coalesce(b.name,'') || ' ' || p2.model),
             p2.kind, coalesce(p2.hsn,''), p2.price_mode
        into v_unit, v_tax, v_desc, v_pkind, v_hsn, v_pmode
        from products p2 left join brands b on b.id = p2.brand_id
       where p2.id = v_pid and p2.status = 'active';
      if v_unit is null then raise exception 'An item is no longer available'; end if;
      if v_pkind in ('frame','sunglass') then v_fdesc := v_desc; v_fpid := v_pid; end if;
      if v_kind = 'order' then
        select qty into v_have from stock where branch_id = v_branch and product_id = v_pid;
        v_have := coalesce(v_have, 0);
        if v_have < v_qty then raise exception 'Not enough stock for % (only % here)', v_desc, v_have; end if;
      end if;

    elsif v_type = 'service' then
      v_unit := (l->>'unit_price')::numeric; v_tax := coalesce((l->>'tax_pct')::numeric, 18);
      v_desc := nullif(trim(l->>'description'), '');
      if v_desc is null or v_unit is null or v_unit < 0
        then raise exception 'Service items need a name and a price'; end if;
      v_hsn := '999999'; v_pmode := 'exclusive';
    else raise exception 'Unknown item type: %', v_type;
    end if;

    if not v_gst then v_tax := 0; end if;

    -- ── Price / tax calculation ──────────────────────────────────────────────
    if v_pmode = 'exclusive' then
      v_taxable := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_tax_amt := round(v_taxable * v_tax / 100, 2);
      v_tot     := v_taxable + v_tax_amt;
      -- Subtotal for exclusive = full price including tax (MRP equivalent)
      v_sub := v_sub + round(v_qty * v_unit * (1 + v_tax/100), 2);
    else -- inclusive (default for Indian retail)
      v_tot     := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_taxable := case when v_tax > 0 then round(v_tot / (1 + v_tax/100), 2) else v_tot end;
      v_tax_amt := v_tot - v_taxable;
      v_sub := v_sub + v_qty * v_unit;
    end if;

    -- ── CGST/SGST vs IGST split ─────────────────────────────────────────────
    if v_gst and v_supply_type = 'intrastate' then
      v_cgst_p := v_tax/2; v_sgst_p := v_tax/2; v_igst_p := 0;
      v_cgst_a := round(v_tax_amt/2, 2); v_sgst_a := v_tax_amt - round(v_tax_amt/2,2); v_igst_a := 0;
    elsif v_gst then
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := v_tax;
      v_cgst_a := 0; v_sgst_a := 0; v_igst_a := v_tax_amt;
    else
      v_cgst_p := 0; v_sgst_p := 0; v_igst_p := 0;
      v_cgst_a := 0; v_sgst_a := 0; v_igst_a := 0;
    end if;

    v_grand       := v_grand + v_tot;
    v_taxable_tot := v_taxable_tot + v_taxable;
    v_cgst_tot    := v_cgst_tot + v_cgst_a;
    v_sgst_tot    := v_sgst_tot + v_sgst_a;
    v_igst_tot    := v_igst_tot + v_igst_a;

    insert into sale_lines (sale_id, line_no, line_type, product_id, lens_package_id, option_ids,
      description, details, qty, unit_price, discount_pct, tax_pct, line_total,
      hsn, price_mode, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt)
    values (v_id, n, v_type, v_pid,
      case when v_type = 'lens' then v_pkg.id end, v_opts,
      v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot,
      v_hsn, v_pmode, v_taxable, v_cgst_p, v_cgst_a, v_sgst_p, v_sgst_a, v_igst_p, v_igst_a)
    returning id into v_lid;

    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (branch_id, product_id, delta, reason, note)
      values (v_branch, v_pid, -v_qty, 'sale', v_code);
    end if;

    if v_kind = 'order' and v_type = 'lens' then
      insert into lab_orders (branch_id, sale_id, sale_line_id, customer_id,
        lens_package_id, lens_desc, lens_details, frame_desc, frame_product_id,
        rx_code, od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add,
        pd_far, pd_near, due_date)
      values (v_branch, v_id, v_lid, v_cust, v_pkg.id, v_desc, v_det, v_fdesc, v_fpid,
        v_rx->>'rx_code',
        (v_rx->>'od_sph')::numeric, (v_rx->>'od_cyl')::numeric,
        (v_rx->>'od_axis')::int,    (v_rx->>'od_add')::numeric,
        (v_rx->>'os_sph')::numeric, (v_rx->>'os_cyl')::numeric,
        (v_rx->>'os_axis')::int,    (v_rx->>'os_add')::numeric,
        (v_rx->>'pd_far')::numeric, (v_rx->>'pd_near')::numeric,
        current_date + v_lead);
    end if;
  end loop;

  if v_kind = 'order' and v_lab and v_rx is null
    then raise exception 'Lens orders need a prescription. Add one first.'; end if;

  update sales set
    subtotal      = v_sub,
    -- FIX: discount_total = listed price − what customer pays (always ≥ 0)
    discount_total = greatest(0, round(v_sub - v_grand, 2)),
    tax_included   = v_cgst_tot + v_sgst_tot + v_igst_tot,
    grand_total    = v_grand,
    taxable_total  = v_taxable_tot,
    cgst_total     = v_cgst_tot,
    sgst_total     = v_sgst_tot,
    igst_total     = v_igst_tot,
    needs_lab      = v_lab,
    status         = case
      when v_kind = 'quotation' then 'draft'
      when v_lab then 'lab_pending'
      else 'ready'
    end
  where id = v_id;

  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (sale_id, amount, method, reference)
    values (v_id, v_pay,
      coalesce(p->'payment'->>'method','cash'),
      nullif(p->'payment'->>'reference',''));
  end if;

  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- ── Fix 2: cancel_order – keep the enhanced version from Build 6 ─────────────
create or replace function cancel_order(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; r record;
begin
  select * into s from sales
  where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status not in ('lab_pending','ready')
    then raise exception 'Cannot cancel an order that is in production or already delivered/cancelled'; end if;
  if exists (select 1 from lab_orders where sale_id = p_id and status not in ('to_buy','cancelled'))
    then raise exception 'Lenses were already bought for this order. Contact the owner to cancel.'; end if;
  if s.paid_total > 0
    then raise exception 'Refund all payments before cancelling (Finance → Credit Notes).'; end if;
  for r in select product_id, qty from sale_lines where sale_id = p_id and product_id is not null loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note)
    values (s.org_id, s.branch_id, r.product_id, r.qty, 'return', s.code || ' cancelled');
  end loop;
  update lab_orders set status = 'cancelled' where sale_id = p_id;
  update sales set status = 'cancelled' where id = p_id;
end $$;

-- ── Fix 3: deliver_order — guard for balance ────────────────────────────────
create or replace function deliver_order(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s sales%rowtype;
begin
  select * into s from sales
  where id = p_id and org_id = public.current_org() and kind = 'order' for update;
  if not found then raise exception 'Order not found'; end if;
  if s.status <> 'ready' then raise exception 'Only orders marked ready can be delivered'; end if;
  if s.paid_total < s.grand_total
    then raise exception 'Balance of ₹% is still due. Collect payment first.', (s.grand_total - s.paid_total); end if;
  update lab_orders set status = 'delivered' where sale_id = p_id and status = 'ready';
  update sales set status = 'delivered' where id = p_id;
end $$;

-- ── Fix 4: ensure gst_applied column exists (back-compat if Build 5 was skipped) ──
alter table sales add column if not exists gst_applied boolean not null default true;

-- ── Fix 5: ensure all new columns from Build 6 exist (safe to re-run) ───────
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

alter table sales
  add column if not exists supply_type text not null default 'intrastate',
  add column if not exists state_of_supply text not null default 'Tamil Nadu',
  add column if not exists recipient_gstin text,
  add column if not exists taxable_total numeric(12,2) not null default 0,
  add column if not exists cgst_total numeric(12,2) not null default 0,
  add column if not exists sgst_total numeric(12,2) not null default 0,
  add column if not exists igst_total numeric(12,2) not null default 0;

alter table products
  add column if not exists hsn text,
  add column if not exists price_mode text not null default 'inclusive';

-- ── Fix 6: back-fill taxable_value for existing sales lines (no tax snapshot) ──
update sale_lines
set taxable_value = case when tax_pct > 0 then round(line_total / (1 + tax_pct/100), 2) else line_total end
where taxable_value = 0 and line_total > 0;
