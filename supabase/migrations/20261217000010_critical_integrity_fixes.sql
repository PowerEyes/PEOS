-- 20261217000010: Critical integrity fixes found by the advanced pilot audit (Nov 2026).
--
-- Applied migrations are never edited in place; each fix here supersedes an
-- older definition or adds a missing constraint. Safe to re-run.

-- ── 1. Deactivated staff must lose all organisation access (RBAC-005) ────────
-- current_org() is the gate behind every RLS policy and every RPC. It checked
-- is_approved only, so flipping profiles.deactivated = true left the account
-- fully authorised until the session was deleted. Include the flag here so
-- revocation takes effect on the next request, not never.
create or replace function public.current_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles
   where id = auth.uid()
     and is_approved
     and coalesce(deactivated, false) = false
$$;

-- ── 2. Two staff registering the same mobile (CRM-010) ──────────────────────
-- The app checks for duplicates before inserting, but two requests can both
-- pass that check. A transaction-scoped advisory lock keyed by
-- (org, digits-only phone) serialises those writers; the second one sees the
-- first row and gets a readable error instead of creating a second customer.
-- Use a trigger rather than a unique index so this migration applies even to
-- databases that already contain the legacy duplicate pair. Once those rows
-- are merged, the plain unique index below can be enabled as well.
create or replace function public.customers_unique_phone() returns trigger
language plpgsql set search_path = public as $$
declare
  v_dup text;
  v_phone text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if v_phone = '' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text || ':' || v_phone, 0));
  select customer_code into v_dup
    from customers
   where org_id = new.org_id
     and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
     and id <> new.id
   limit 1;
  if found then
    raise exception 'A customer already exists (%) with this mobile number. Open that record instead of creating a duplicate.', v_dup;
  end if;
  return new;
end $$;
drop trigger if exists trg_customers_unique_phone on customers;
create trigger trg_customers_unique_phone
  before insert or update of phone, org_id on customers
  for each row execute function public.customers_unique_phone();

-- Optional backstop for clean databases. If this migration fails here, merge
-- the reported duplicates first (see pilot report), then re-run just this line.
-- create unique index if not exists customers_org_phone_uq
--   on customers (org_id, regexp_replace(phone, '\D', '', 'g'))
--   where phone is not null and phone <> '';

-- ── 3. Barcode reused on two products (INV-008) ─────────────────────────────
-- Sale lines snapshot product details, but scanning resolves the barcode to a
-- single product. A shared barcode silently bills the wrong SKU; reject it.
-- Current data has no duplicate non-empty barcodes, so this applies cleanly.
create unique index if not exists products_org_barcode_uq
  on products (org_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

-- ── 4. Expired / unapproved prescriptions cannot open a new order (RX-018) ──
-- The order already snapshots the prescription (rx_snapshot), so editing the
-- original never rewrites a placed order. The missing piece was a check at
-- order creation: an expired Rx could still be sold and only showed a coloured
-- pill in the list. Quotations are exempt; an order is the clinical hand-off.
create or replace function public.sales_rx_valid() returns trigger
language plpgsql set search_path = public as $$
declare
  v_status text;
  v_valid date;
  v_review text;
begin
  if new.prescription_id is null or new.kind <> 'order' then return new; end if;
  select status, valid_till, to_jsonb(p)->>'review_status' into v_status, v_valid, v_review
    from prescriptions p where p.id = new.prescription_id;
  if not found then
    raise exception 'That prescription no longer exists. Choose a current one.';
  end if;
  if coalesce(v_status, 'active') <> 'active' then
    raise exception 'That prescription is % and cannot be used for a new order.', v_status;
  end if;
  -- tolerate either schema: older databases have no review_status column.
  if v_review is not null and v_review not in ('approved', 'pending') then
    raise exception 'That prescription is % and needs optometrist approval before a new order.', v_review;
  end if;
  if v_valid is not null and v_valid < current_date then
    raise exception 'That prescription expired on %. Renew it before placing a new order.', v_valid;
  end if;
  return new;
end $$;
drop trigger if exists trg_sales_rx_valid on sales;
create trigger trg_sales_rx_valid
  before insert or update of prescription_id, kind on sales
  for each row execute function public.sales_rx_valid();

-- ── 5. Incomplete cylinder/axis combinations (RX-012) ───────────────────────
-- The UI warns, but the exam form writes prescriptions through a different
-- server action that only checked numeric ranges. Enforce the pair in the
-- database so no writer (OCR, portal, exam, import) can store half a pair.
create or replace function public.prescriptions_check_pairs() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(new.od_cyl, 0) <> 0 and new.od_axis is null then
    raise exception 'Right eye (OD): add an axis because a cylinder is set.';
  end if;
  if coalesce(new.os_cyl, 0) <> 0 and new.os_axis is null then
    raise exception 'Left eye (OS): add an axis because a cylinder is set.';
  end if;
  if coalesce(new.od_cyl, 0) = 0 and new.od_axis is not null
     and coalesce(new.od_sph, 0) = 0 and coalesce(new.od_add, 0) = 0 then
    raise exception 'Right eye (OD): an axis needs a cylinder.';
  end if;
  if coalesce(new.os_cyl, 0) = 0 and new.os_axis is not null
     and coalesce(new.os_sph, 0) = 0 and coalesce(new.os_add, 0) = 0 then
    raise exception 'Left eye (OS): an axis needs a cylinder.';
  end if;
  return new;
end $$;
drop trigger if exists trg_rx_pairs on prescriptions;
create trigger trg_rx_pairs before insert or update on prescriptions
  for each row execute function public.prescriptions_check_pairs();

-- ── 6. Visual acuity must reach the prescription (RX-006 / RX-020) ──────────
-- save_eye_examination writes the prescription before the examination, so a
-- column-list insert cannot see the VA captured on the exam. Copy the aided VA
-- (falling back to unaided) into the linked prescription in the same
-- transaction. Aided values already on the Rx are never overwritten by nulls.
create or replace function public.exam_va_to_prescription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.prescription_id is null then return new; end if;
  update public.prescriptions p
     set od_va_dist = coalesce(new.va_od_dist_a, new.va_od_dist_ua, p.od_va_dist),
         os_va_dist = coalesce(new.va_os_dist_a, new.va_os_dist_ua, p.os_va_dist),
         od_va_near = coalesce(new.va_od_near_a, new.va_od_near_ua, p.od_va_near),
         os_va_near = coalesce(new.va_os_near_a, new.va_os_near_ua, p.os_va_near)
   where p.id = new.prescription_id
     and p.org_id = new.org_id;
  return new;
end $$;
drop trigger if exists trg_exam_va_to_rx on eye_examinations;
create trigger trg_exam_va_to_rx
  after insert or update of prescription_id, va_od_dist_a, va_os_dist_a, va_od_near_a, va_os_near_a
  on eye_examinations
  for each row execute function public.exam_va_to_prescription();
