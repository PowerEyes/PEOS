create or replace function public.place_sale(p jsonb) returns jsonb language plpgsql as $$
declare
  v_org uuid := public.current_org(); v_kind text := p->>'kind'; v_cust uuid := (p->>'customer_id')::uuid; v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid; v_qid uuid := (p->>'quotation_id')::uuid; v_rx jsonb; v_role text; v_maxdisc numeric;
  v_id uuid; v_code text; l jsonb; n int := 0; v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text; v_tot numeric;
  v_sub numeric := 0; v_dsc numeric := 0; v_taxinc numeric := 0; v_grand numeric := 0; v_lab boolean := false;
  v_pid uuid; v_have int; v_pkg lens_packages%rowtype; v_opts uuid[]; v_optsum numeric; v_optnames text;
  v_pay numeric := coalesce((p->'payment'->>'amount')::numeric, 0);
  v_idem text := nullif(p->>'idempotency_key', '');
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

  if v_idem is not null and v_idem <> '' then
    select id, code into v_id, v_code from sales where org_id = v_org and idempotency_key = v_idem::uuid limit 1;
    if v_id is not null then return jsonb_build_object('id', v_id, 'code', v_code, 'idempotent', true); end if;
  end if;
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
