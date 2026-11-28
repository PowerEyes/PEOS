-- Staging verification for the unified prescription approval gate.
--
-- Apply the full migration stream to a disposable/cloned database first, then:
--   psql -v ON_ERROR_STOP=1 -f prescription_approval.sql
-- Everything runs in one transaction and is rolled back. Do not run against
-- live or production data.

begin;

create or replace function pg_temp.expect_rows(sql text, want int, label text)
returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if;
  raise notice 'ok   %', label;
end $$;

create or replace function pg_temp.expect_error(sql text, pattern text, label text)
returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % did not raise', label;
exception when others then
  if sqlerrm not ilike '%' || pattern || '%' then
    raise exception 'FAIL: % raised %, expected %', label, sqlerrm, pattern;
  end if;
  raise notice 'ok   %', label;
end $$;

create or replace function pg_temp.as_user(u uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

create or replace function pg_temp.as_service()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  set local role service_role;
end $$;

-- ── Exactly one enabled, org-scoped gate ─────────────────────────────────────
select pg_temp.expect_rows($q$
  select 1 from pg_trigger
   where tgrelid = 'public.sales'::regclass
     and not tgisinternal
     and tgenabled = 'O'
     and pg_get_triggerdef(oid) ilike '%require_approved_sale_prescription%'
$q$, 1, 'the strict approval trigger is the one enabled Rx gate');

select pg_temp.expect_rows($q$
  select 1 from pg_trigger
   where tgrelid = 'public.sales'::regclass
     and tgname = 'trg_sales_rx_valid'
     and tgenabled = 'O'
$q$, 0, 'the tolerant trg_sales_rx_valid gate is disabled');

-- ── Fixtures ─────────────────────────────────────────────────────────────────
create temp table _rx as
select gen_random_uuid() org,
       gen_random_uuid() other_org,
       gen_random_uuid() owner,
       gen_random_uuid() optometrist,
       gen_random_uuid() cashier,
       gen_random_uuid() customer,
       gen_random_uuid() other_customer,
       gen_random_uuid() branch,
       gen_random_uuid() other_branch,
       gen_random_uuid() product,
       gen_random_uuid() rx_ok,
       gen_random_uuid() rx_pending,
       gen_random_uuid() rx_no_actor,
       gen_random_uuid() rx_expired,
       gen_random_uuid() rx_inactive,
       gen_random_uuid() rx_cross,
       gen_random_uuid() rx_sale_linked;
grant select on _rx to public;

insert into public.organizations (id, name)
select org, 'Rx Test Org' from _rx
union all select other_org, 'Rx Other Org' from _rx;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select id, email, now(), '{"is_staff":"true"}'::jsonb
from _rx f
cross join lateral (values
  (f.owner, 'rx-owner@test.dev'),
  (f.optometrist, 'rx-optometrist@test.dev'),
  (f.cashier, 'rx-cashier@test.dev')
) as u(id, email);

insert into public.profiles (id, org_id, full_name, role_key, is_approved, deactivated)
select owner, org, 'Rx Owner', 'owner', true, false from _rx
union all select optometrist, org, 'Rx Optometrist', 'optometrist', true, false from _rx
union all select cashier, org, 'Rx Cashier', 'cashier', true, false from _rx;

insert into public.branches (id, org_id, code, name)
select branch, org, 'RX-MAIN', 'Rx Main' from _rx
union all select other_branch, other_org, 'RX-OTHER', 'Rx Other' from _rx;

insert into public.customers (id, org_id, branch_id, full_name, phone)
select customer, org, branch, 'Rx Customer', '9500000001' from _rx
union all select other_customer, other_org, other_branch, 'Rx Other Customer', '9500000002' from _rx;

insert into public.products (id, org_id, kind, model, selling_price, tax_pct)
select product, org, 'accessory', 'Rx Accessory', 100, 5 from _rx;

insert into public.stock (org_id, branch_id, product_id, qty)
select org, branch, product, 100 from _rx;

insert into public.org_settings (org_id, key, value)
select org, 'gst_enabled', 'true'::jsonb from _rx
union all select org, 'max_staff_discount_pct', '5'::jsonb from _rx;

-- All fixtures start in the default 'pending' state.
insert into public.prescriptions
  (id, org_id, branch_id, customer_id, rx_date, valid_till, status, od_sph, os_sph)
select rx_ok, org, branch, customer, now(), current_date + 30, 'active', -1, -1 from _rx
union all select rx_pending, org, branch, customer, now(), current_date + 30, 'active', -2, -2 from _rx
union all select rx_expired, org, branch, customer, now(), current_date - 1, 'active', -3, -3 from _rx
union all select rx_inactive, org, branch, customer, now(), current_date + 30, 'active', -4, -4 from _rx
union all select rx_cross, other_org, other_branch, other_customer, now(), current_date + 30, 'active', -5, -5 from _rx
union all select rx_sale_linked, org, branch, customer, now(), current_date + 30, 'active', -6, -6 from _rx;

-- A service-role-owned definer can create an intentionally malformed historical
-- approval (approved status, no approver) for the guard test.
select pg_temp.as_service();
insert into public.prescriptions
  (id, org_id, branch_id, customer_id, rx_date, valid_till, status, review_status, od_sph, os_sph)
select rx_no_actor, org, branch, customer, now(), current_date + 30, 'active', 'approved', -7, -7 from _rx;
reset role;

-- Simulate a legacy sale that was placed before the strict gate existed. The
-- trigger is disabled only inside this rolled-back transaction.
alter table public.sales disable trigger trg_sales_require_approved_prescription;
insert into public.sales
  (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
select org, branch, customer, rx_sale_linked, 100, 'order', 'draft' from _rx;
alter table public.sales enable trigger trg_sales_require_approved_prescription;

-- ── Approval cannot be forged by direct table writes ─────────────────────────
select pg_temp.as_user((select owner from _rx));
select pg_temp.expect_error($q$
  update public.prescriptions
     set review_status = 'approved', approved_by = (select owner from _rx), approved_at = now()
   where id = (select rx_pending from _rx)
$q$, 'Use set_prescription_review', 'owner cannot self-approve with a direct UPDATE');

select pg_temp.expect_error($q$
  insert into public.prescriptions
    (org_id, branch_id, customer_id, rx_date, valid_till, review_status, approved_by)
  select org, branch, customer, now(), current_date + 30, 'approved', owner from _rx
$q$, 'Use set_prescription_review', 'approved prescription cannot be inserted directly');

select pg_temp.as_user((select cashier from _rx));
select pg_temp.expect_error($q$
  select public.set_prescription_review((select rx_pending from _rx), 'approve', 'cashier attempt')
$q$, 'Only an approved owner, admin or optometrist', 'cashier cannot call the review RPC');

-- ── Authorised RPC approval and clinical-edit reset ──────────────────────────
select pg_temp.as_user((select optometrist from _rx));
select public.set_prescription_review((select rx_ok from _rx), 'approve', 'staging verification');

select pg_temp.expect_rows($q$
  select 1 from public.prescriptions
   where id = (select rx_ok from _rx)
     and review_status = 'approved'
     and approved_by = (select optometrist from _rx)
     and approved_at is not null
$q$, 1, 'optometrist approval is stored with actor and timestamp');

select pg_temp.expect_rows($q$
  select 1 from public.prescription_audit_log
   where prescription_id = (select rx_ok from _rx)
     and action = 'approved'
     and performed_by = (select optometrist from _rx)
     and reason = 'staging verification'
$q$, 1, 'approval writes a dedicated prescription audit row');

-- A valid same-org, active, unexpired, approved Rx is sellable.
insert into public.sales
  (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
select org, branch, customer, rx_ok, 100, 'order', 'draft' from _rx;

select pg_temp.expect_rows($q$
  select 1 from public.sales
   where org_id = (select org from _rx)
     and prescription_id = (select rx_ok from _rx)
$q$, 1, 'approved Rx is accepted by the sales gate');

select pg_temp.as_user((select owner from _rx));
update public.prescriptions set od_sph = -2.25 where id = (select rx_ok from _rx);

select pg_temp.expect_rows($q$
  select 1 from public.prescriptions
   where id = (select rx_ok from _rx)
     and review_status = 'pending'
     and approved_by is null
     and approved_at is null
$q$, 1, 'clinical edit clears the prior approval');

select pg_temp.expect_rows($q$
  select 1 from public.prescription_audit_log
   where prescription_id = (select rx_ok from _rx)
     and action = 'corrected'
     and performed_by = (select owner from _rx)
$q$, 1, 'clinical edit resets approval in the prescription audit log');

-- ── All rejection paths ──────────────────────────────────────────────────────
select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_pending, 100, 'order', 'draft' from _rx
$q$, 'must approve', 'pending Rx is rejected for an order');

select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_pending, 100, 'quotation', 'draft' from _rx
$q$, 'must approve', 'pending Rx is rejected for a quotation too');

select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_no_actor, 100, 'order', 'draft' from _rx
$q$, 'must approve', 'approved Rx without an approver is rejected');

select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_cross, 100, 'order', 'draft' from _rx
$q$, 'not available to this organisation', 'cross-org Rx id is rejected');

select pg_temp.as_user((select optometrist from _rx));
select public.set_prescription_review((select rx_expired from _rx), 'approve', 'expired test');
select public.set_prescription_review((select rx_inactive from _rx), 'approve', 'inactive test');

select pg_temp.as_service();
update public.prescriptions set status = 'rejected' where id = (select rx_inactive from _rx);
reset role;

select pg_temp.as_user((select owner from _rx));
select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_expired, 100, 'order', 'draft' from _rx
$q$, 'expired', 'expired Rx is rejected even when marked approved');

select pg_temp.expect_error($q$
  insert into public.sales
    (org_id, branch_id, customer_id, prescription_id, grand_total, kind, status)
  select org, branch, customer, rx_inactive, 100, 'order', 'draft' from _rx
$q$, 'is rejected', 'non-active Rx is rejected even when marked approved');

-- ── place_sale obeys the same table-boundary rule ────────────────────────────
select pg_temp.expect_error($q$
  select public.place_sale(jsonb_build_object(
    'kind', 'order',
    'customer_id', (select customer from _rx),
    'branch_id', (select branch from _rx),
    'prescription_id', (select rx_pending from _rx),
    'lines', jsonb_build_array(jsonb_build_object(
      'line_type', 'product', 'product_id', (select product from _rx), 'qty', 1))
  ))
$q$, 'must approve', 'place_sale cannot bypass the Rx approval gate');

-- ── Conservative, auditable backfill ─────────────────────────────────────────
select pg_temp.as_service();

select pg_temp.expect_error($q$
  select public.backfill_legacy_prescription_approvals(
    jsonb_build_object((select org::text from _rx), (select gen_random_uuid()::text from _rx)),
    'invalid actor test')
$q$, 'not an active authorised reviewer', 'backfill rejects an invalid actor map');

select pg_temp.expect_rows($q$
  select 1 where public.backfill_legacy_prescription_approvals(
    jsonb_build_object((select org::text from _rx), (select owner::text from _rx)),
    'staging legacy Rx verification') = 1
$q$, 1, 'backfill approves exactly the sale-linked pending Rx');

select pg_temp.expect_rows($q$
  select 1 where public.backfill_legacy_prescription_approvals(
    jsonb_build_object((select org::text from _rx), (select owner::text from _rx)),
    'staging legacy Rx verification') = 0
$q$, 1, 'backfill is idempotent');

select pg_temp.expect_rows($q$
  select 1 from public.prescriptions
   where id = (select rx_sale_linked from _rx)
     and review_status = 'approved'
     and approved_by = (select owner from _rx)
$q$, 1, 'backfilled Rx has the mapped same-org actor');

select pg_temp.expect_rows($q$
  select 1 from public.prescription_audit_log
   where prescription_id = (select rx_sale_linked from _rx)
     and action = 'approved'
     and performed_by = (select owner from _rx)
     and reason ilike '%already used by sale%'
$q$, 1, 'backfill writes an audited reason naming the legacy sale');

select pg_temp.expect_rows($q$
  select 1 from public.prescriptions p
   where p.org_id = (select org from _rx)
     and p.status = 'active'
     and (p.valid_till is null or p.valid_till >= current_date)
     and exists (select 1 from public.sales s where s.prescription_id = p.id)
     and (p.review_status is distinct from 'approved' or p.approved_by is null)
$q$, 0, 'no active sale-linked Rx in this org remains unapproved');

select pg_temp.expect_error($q$
  update public.prescription_audit_log set reason = 'tampered'
   where prescription_id = (select rx_sale_linked from _rx)
$q$, 'append-only', 'prescription audit log cannot be rewritten');

reset role;
rollback;
\echo 'ALL PRESCRIPTION APPROVAL CHECKS PASSED'
