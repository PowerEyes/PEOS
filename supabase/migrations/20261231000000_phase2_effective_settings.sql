-- Phase 2: settings-aware transaction readers. Supplied only; do not apply as
-- part of this read-only audit. This supersedes the legacy key reads left in
-- 20261217000020_place_sale_restore.sql and 0026_settings_system.sql.
--
-- Existing writers still write legacy org_settings keys, so the helper reads
-- canonical catalog keys first and legacy keys second. Invalid values fall back
-- to catalog defaults (or built-in defaults when a catalog row is missing).

-- ── 1. Validated effective-value helper ──────────────────────────────────────
create or replace function public.effective_setting(
  p_org uuid,
  p_key text,
  p_branch uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session_org uuid := public.current_org();
  v_call_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_def public.setting_definitions%rowtype;
  v_canonical text;
  v_value jsonb;
  v_default jsonb := case
    when p_key in ('tax.gst_enabled', 'gst_enabled') then 'true'::jsonb
    when p_key in ('tax.gstin', 'gstin') then '""'::jsonb
    when p_key in ('tax.default_supply_type', 'default_supply_type') then '"intrastate"'::jsonb
    when p_key in ('tax.default_state_of_supply', 'default_state_of_supply') then '"Tamil Nadu"'::jsonb
    when p_key in ('tax.invoice_footer', 'invoice_footer') then '""'::jsonb
    when p_key in ('sales.max_discount_pct', 'max_staff_discount_pct') then '10'::jsonb
    when p_key in ('sales.quote_valid_days', 'quotation_valid_days') then '14'::jsonb
    when p_key in ('lab.lead_days', 'lab_lead_days') then '5'::jsonb
    when p_key in ('numbering.code_prefixes', 'code_prefixes') then '{}'::jsonb
    when p_key like 'module.%' then 'true'::jsonb
    else null
  end;
begin
  -- Authenticated callers are bound to their own organisation. Service-role
  -- callers (storefront checkout) pass an explicit org id.
  if v_session_org is not null then
    if p_org is distinct from v_session_org then
      raise exception 'Organisation mismatch for setting %', p_key;
    end if;
  elsif v_call_role <> 'service_role' and session_user <> 'postgres' then
    raise exception 'No organisation context for setting %', p_key;
  end if;

  select d.* into v_def
    from public.setting_definitions d
   where not d.deprecated
     and (d.key = p_key or d.legacy_key = p_key)
   order by case when d.key = p_key then 0 else 1 end
   limit 1;

  v_canonical := coalesce(v_def.key, p_key);
  v_default := coalesce(v_def.default_value, v_default);

  if v_def.scope = 'branch' and p_branch is not null then
    select s.value into v_value
      from public.branch_settings s
     where s.org_id = p_org
       and s.branch_id = p_branch
       and s.key = v_canonical;
  end if;

  if v_value is null then
    select s.value into v_value
      from public.org_settings s
     where s.org_id = p_org
       and (
         s.key = v_canonical
         or s.key = p_key
         or (v_def.legacy_key is not null and s.key = v_def.legacy_key)
       )
     order by case
       when s.key = v_canonical then 0
       when s.key = p_key then 1
       else 2
     end
     limit 1;
  end if;

  if v_value is not null and public.validate_setting_value(v_canonical, v_value) then
    return v_value;
  end if;

  return coalesce(v_default, 'null'::jsonb);
end $$;

revoke all on function public.effective_setting(uuid,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.effective_setting(uuid,text,uuid) to authenticated, service_role;

comment on function public.effective_setting(uuid,text,uuid) is
  'Validated org/branch effective setting with canonical-first, legacy-fallback resolution and fail-closed defaults.';

-- ── 2. place_sale: org-bound settings, advisory lock, canonical transaction values ──
create or replace function public.place_sale(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_session_org uuid := public.current_org();
  v_requested_org uuid := case
    when p->>'org_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (p->>'org_id')::uuid
  end;
  v_call_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_org uuid := coalesce(v_session_org, v_requested_org);
  v_kind text := p->>'kind';
  v_cust uuid := (p->>'customer_id')::uuid;
  v_branch uuid := (p->>'branch_id')::uuid;
  v_rx_id uuid := (p->>'prescription_id')::uuid;
  v_qid uuid := (p->>'quotation_id')::uuid;
  v_rx jsonb; v_role text; v_maxdisc numeric;
  v_gst boolean;
  v_lead int;
  v_quote_days int;
  v_supply_type text;
  v_default_supply text;
  v_state_of_supply text;
  v_recipient_gstin text := nullif(trim(coalesce(p->>'recipient_gstin','')), '');
  v_idem uuid := nullif(nullif(p->>'idempotency_key', ''), '')::uuid;
  v_id uuid; v_code text; v_lid uuid; l jsonb; n int := 0;
  v_type text; v_qty int; v_disc numeric; v_unit numeric; v_tax numeric; v_desc text; v_det text;
  v_hsn text; v_pmode text;
  v_taxable numeric; v_tax_amt numeric; v_cgst_p numeric; v_sgst_p numeric; v_igst_p numeric;
  v_cgst_a numeric; v_sgst_a numeric; v_igst_a numeric; v_tot numeric;
  v_sub numeric := 0; v_grand numeric := 0; v_taxable_tot numeric := 0;
  v_cgst_tot numeric := 0; v_sgst_tot numeric := 0; v_igst_tot numeric := 0;
  v_lab boolean := false; v_pkind text; v_fdesc text; v_fpid uuid;
  v_pid uuid; v_have int; v_pkg lens_packages%rowtype; v_opts uuid[]; v_optsum numeric; v_optnames text;
  v_pay numeric := coalesce((p->'payment'->>'amount')::numeric, 0);
begin
  if v_session_org is not null and v_requested_org is not null and v_requested_org <> v_session_org then
    raise exception 'Organisation mismatch';
  end if;
  if v_org is null then
    if v_call_role <> 'service_role' and current_user <> 'postgres' then
      raise exception 'Only approved staff can create sales';
    end if;
    raise exception 'An organisation is required for storefront sales';
  end if;
  if v_kind not in ('quotation','order') then raise exception 'Unknown sale type'; end if;

  -- Resolved from validated catalog values, not hardcoded transaction defaults.
  v_gst := coalesce((public.effective_setting(v_org, 'tax.gst_enabled') #>> '{}')::boolean, true);
  v_lead := least(365, greatest(1, coalesce((public.effective_setting(v_org, 'lab.lead_days') #>> '{}')::int, 5)));
  v_quote_days := least(365, greatest(1, coalesce((public.effective_setting(v_org, 'sales.quote_valid_days') #>> '{}')::int, 14)));
  v_default_supply := case
    when public.effective_setting(v_org, 'tax.default_supply_type') #>> '{}' = 'interstate' then 'interstate'
    else 'intrastate'
  end;
  v_supply_type := case
    when p->>'supply_type' in ('intrastate','interstate') then p->>'supply_type'
    else v_default_supply
  end;
  v_state_of_supply := coalesce(
    nullif(p->>'state_of_supply', ''),
    nullif(public.effective_setting(v_org, 'tax.default_state_of_supply') #>> '{}', ''),
    'Tamil Nadu'
  );

  -- Replay: return the original sale instead of creating a second one.
  if v_idem is not null then
    -- Serialise concurrent replays before the read; keep the unique-violation
    -- fallback below for callers that omitted an idempotency key.
    perform pg_advisory_xact_lock(hashtextextended(v_org::text || v_idem, 0));
    select id, code into v_id, v_code
      from sales where org_id = v_org and idempotency_key = v_idem limit 1;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'code', v_code, 'idempotent', true);
    end if;
  end if;

  select role_key into v_role from profiles where id = auth.uid();
  v_maxdisc := least(100, greatest(0, coalesce(
    (public.effective_setting(v_org, 'sales.max_discount_pct') #>> '{}')::numeric, 10
  )));
  if not exists (select 1 from customers where id = v_cust and org_id = v_org) then raise exception 'Choose a customer'; end if;
  if not exists (select 1 from branches where id = v_branch and org_id = v_org) then raise exception 'Choose a branch'; end if;
  if v_rx_id is not null then
    select to_jsonb(r) into v_rx from prescriptions r
     where r.id = v_rx_id and r.customer_id = v_cust and r.org_id = v_org;
    if v_rx is null then raise exception 'That prescription does not belong to this customer'; end if;
  end if;
  if v_qid is not null and not exists (
    select 1 from sales
     where id = v_qid and org_id = v_org and kind = 'quotation' and status in ('draft','sent')
  ) then raise exception 'That quotation can no longer be converted'; end if;
  if jsonb_array_length(coalesce(p->'lines','[]'::jsonb)) = 0 then raise exception 'Add at least one item'; end if;

  begin
    insert into sales (org_id, branch_id, kind, customer_id, prescription_id, rx_snapshot, source_quotation_id,
      status, notes, gst_applied, supply_type, state_of_supply, recipient_gstin, valid_until, idempotency_key)
    values (v_org, v_branch, v_kind, v_cust, v_rx_id, v_rx, v_qid, 'draft', nullif(p->>'notes',''),
      v_gst, v_supply_type, v_state_of_supply, v_recipient_gstin,
      case when v_kind = 'quotation' then coalesce((p->>'valid_until')::date, current_date + v_quote_days) end,
      v_idem)
    returning id, code into v_id, v_code;
  exception when unique_violation then
    -- Two requests with the same key arrived together; the winner owns the sale.
    if v_idem is not null then
      select id, code into v_id, v_code
        from sales where org_id = v_org and idempotency_key = v_idem limit 1;
      if v_id is not null then
        return jsonb_build_object('id', v_id, 'code', v_code, 'idempotent', true);
      end if;
    end if;
    raise;
  end;

  for l in select * from jsonb_array_elements(p->'lines') loop
    n := n + 1; v_type := l->>'line_type'; v_pid := null; v_det := null; v_opts := '{}';
    v_hsn := null; v_pmode := 'inclusive';
    v_qty := greatest(1, coalesce((l->>'qty')::int, 1));
    v_disc := coalesce((l->>'discount_pct')::numeric, 0);
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100'; end if;
    if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin')
      then raise exception 'Discounts above % percent need an owner or admin', v_maxdisc; end if;

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
      if v_unit is null then raise exception 'An item in the bag is no longer available'; end if;
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

    if v_pmode = 'exclusive' then
      v_taxable := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_tax_amt := round(v_taxable * v_tax / 100, 2);
      v_tot     := v_taxable + v_tax_amt;
      v_sub     := v_sub + round(v_qty * v_unit * (1 + v_tax/100), 2);
    else
      v_tot     := round(v_qty * v_unit * (1 - v_disc/100), 2);
      v_taxable := case when v_tax > 0 then round(v_tot / (1 + v_tax/100), 2) else v_tot end;
      v_tax_amt := v_tot - v_taxable;
      v_sub     := v_sub + v_qty * v_unit;
    end if;

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

    insert into sale_lines (org_id, sale_id, line_no, line_type, product_id, lens_package_id, option_ids,
      description, details, qty, unit_price, discount_pct, tax_pct, line_total,
      hsn, price_mode, taxable_value, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt)
    values (v_org, v_id, n, v_type, v_pid,
      case when v_type = 'lens' then v_pkg.id end, v_opts,
      v_desc, v_det, v_qty, v_unit, v_disc, v_tax, v_tot,
      v_hsn, v_pmode, v_taxable, v_cgst_p, v_cgst_a, v_sgst_p, v_sgst_a, v_igst_p, v_igst_a)
    returning id into v_lid;

    if v_kind = 'order' and v_pid is not null then
      insert into stock_movements (org_id, branch_id, product_id, delta, reason, note)
      values (v_org, v_branch, v_pid, -v_qty, 'sale', v_code);
    end if;

    if v_kind = 'order' and v_type = 'lens' then
      insert into lab_orders (org_id, branch_id, sale_id, sale_line_id, customer_id,
        lens_package_id, lens_desc, lens_details, frame_desc, frame_product_id,
        rx_code, od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add,
        pd_far, pd_near, due_date)
      values (v_org, v_branch, v_id, v_lid, v_cust, v_pkg.id, v_desc, v_det, v_fdesc, v_fpid,
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
    subtotal       = v_sub,
    discount_total = greatest(0, round(v_sub - v_grand, 2)),
    tax_included   = v_cgst_tot + v_sgst_tot + v_igst_tot,
    grand_total    = v_grand,
    taxable_total  = v_taxable_tot,
    cgst_total     = v_cgst_tot,
    sgst_total     = v_sgst_tot,
    igst_total     = v_igst_tot,
    needs_lab      = v_lab,
    status         = case when v_kind = 'quotation' then 'draft'
                          when v_lab then 'lab_pending' else 'ready' end
  where id = v_id;

  if v_qid is not null then update sales set status = 'converted' where id = v_qid; end if;
  if v_kind = 'order' and v_pay > 0 then
    insert into payments (org_id, sale_id, amount, method, reference)
    values (v_org, v_id, v_pay, coalesce(p->'payment'->>'method','cash'),
      nullif(p->'payment'->>'reference',''));
  end if;

  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

revoke all on function public.place_sale(jsonb) from public, anon;
grant execute on function public.place_sale(jsonb) to authenticated, service_role;

comment on function public.place_sale(jsonb) is
  'Sales writer bound to the quote/session org with validated settings values and idempotency locking.';

-- ── 3. next_code: canonical prefix with legacy fallback ──────────────────────
create or replace function public.next_code(p_org uuid, p_key text, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n int;
  v_prefixes jsonb;
  v_prefix text;
begin
  v_prefixes := public.effective_setting(p_org, 'numbering.code_prefixes');

  if jsonb_typeof(v_prefixes) = 'object' then
    v_prefix := nullif(v_prefixes ->> p_key, '');
  end if;

  -- Final belt-and-braces fallback for databases where the catalog row was not
  -- seeded: the helper already handles the normal canonical/legacy mapping.
  if v_prefix is null then
    select case when jsonb_typeof(value) = 'object' then nullif(value ->> p_key, '') end
      into v_prefix
      from public.org_settings
     where org_id = p_org and key = 'code_prefixes';
  end if;

  v_prefix := coalesce(v_prefix, p_prefix);
  insert into counters(org_id,key,value) values (p_org,p_key,1)
  on conflict (org_id,key) do update set value = counters.value + 1 returning value into n;
  return v_prefix || lpad(n::text, 4, '0');
end $$;

revoke all on function public.next_code(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.next_code(uuid,text,text) to authenticated, service_role;

comment on function public.next_code(uuid,text,text) is
  'Sequential document code generator using the validated numbering.code_prefixes catalog value.';
