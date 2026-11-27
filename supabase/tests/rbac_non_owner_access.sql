-- Non-owner RBAC + IDOR suite using the reusable fixture file.
-- Run on a migrated scratch database:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rbac_non_owner_access.sql
-- Everything runs in one transaction and is rolled back.

begin;

create or replace function pg_temp.expect_rows(sql text, want int, label text)
returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if;
  raise notice 'ok   %', label;
end $$;

create or replace function pg_temp.expect_fail(sql text, label text)
returns void language plpgsql as $$
declare blocked boolean := false; n int;
begin
  begin
    execute sql;
    get diagnostics n = row_count;
    blocked := n = 0; -- RLS filters silently; zero rows also counts as blocked
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL (should be blocked): %', label; end if;
  raise notice 'ok   blocked: %', label;
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

-- The fixture seeds service-only helpers and deterministic rows as the caller
-- (migration owner/superuser), then all probes below switch to authenticated.
\ir rbac_role_fixtures.sql

-- ── Exact effective grants ───────────────────────────────────────────────────
select pg_temp.as_user(pg_temp.rbac_uid('owner'));
select pg_temp.expect_rows(
  $q$select 1 where public.my_permissions() = array[
    'finance_view', 'expenses', 'day_closing', 'catalogue_edit', 'reports_view',
    'crm_manage', 'discount_override', 'stock_adjust', 'purchases_manage',
    'stock_audit', 'transfers_approve', 'web_orders', 'credit_notes.issue'
  ]::text[]$q$,
  1, 'owner bypasses has_perm() and sees the full 13-key catalogue');

select pg_temp.as_user(pg_temp.rbac_uid('admin'));
select pg_temp.expect_rows(
  $q$select 1 where public.my_permissions() = array[
    'finance_view', 'expenses', 'day_closing', 'catalogue_edit', 'reports_view',
    'crm_manage', 'discount_override', 'stock_adjust', 'purchases_manage',
    'stock_audit', 'transfers_approve', 'web_orders', 'credit_notes.issue'
  ]::text[]$q$,
  1, 'admin is the company-manager tier and bypasses has_perm()');
select pg_temp.expect_fail(
  $q$select public.admin_update_staff((select owner_id from _rbac), 'staff')$q$,
  'admin cannot manage an owner');
select pg_temp.expect_fail(
  format('select 1 where public.can_write_setting(%L)', 'branches.gstin'),
  'admin cannot write an owner-only catalog setting');

select pg_temp.as_user(pg_temp.rbac_uid('branch_manager'));
select pg_temp.expect_rows(
  $q$select 1 where cardinality(public.my_permissions()) = 13$q$,
  1, 'branch_manager has all 13 default grants');
select pg_temp.expect_rows(
  $q$select 1 from public.product_costs where product_id = (select product_id from _rbac)$q$,
  1, 'branch_manager can read cost prices in its own branch scope');

select pg_temp.as_user(pg_temp.rbac_uid('cashier'));
select pg_temp.expect_rows(
  $q$select 1 where public.my_permissions() = array['finance_view', 'credit_notes.issue']::text[]$q$,
  1, 'cashier has exactly finance_view and credit_notes.issue');
select pg_temp.expect_rows('select 1 where public.has_perm(''finance_view'')', 1,
  'cashier can view finance');
select pg_temp.expect_rows('select 1 from public.product_costs', 0,
  'cashier cannot read cost prices');
select pg_temp.expect_fail(
  format('update public.product_costs set cost_price = 1 where product_id = %L',
         (select product_id from _rbac)),
  'cashier cannot write a cost price');

select pg_temp.as_user(pg_temp.rbac_uid('optometrist'));
select pg_temp.expect_rows(
  $q$select 1 where cardinality(public.my_permissions()) = 0$q$,
  1, 'optometrist has no money/catalogue permissions');
select pg_temp.expect_rows('select 1 from public.product_costs', 0,
  'optometrist cannot read cost prices');
select pg_temp.expect_fail(
  format('update public.sales set grand_total = 1 where id = %L',
         (select sale_id from _rbac)),
  'optometrist in West cannot edit an East-branch sale');

select pg_temp.as_user(pg_temp.rbac_uid('staff'));
select pg_temp.expect_rows(
  $q$select 1 where cardinality(public.my_permissions()) = 0$q$,
  1, 'plain staff is the baseline-denied control');

-- ── Escalation and cross-tenant IDOR probes ──────────────────────────────────
select pg_temp.as_user(pg_temp.rbac_uid('cashier'));
select pg_temp.expect_fail(
  format('update public.profiles set role_key = ''owner'' where id = %L',
         (select cashier_id from _rbac)),
  'cashier cannot promote itself');
select pg_temp.expect_fail(
  format('select public.set_profile_branches(%L, array[%L]::uuid[])',
         (select cashier_id from _rbac), (select branch_west from _rbac)),
  'cashier cannot grant itself a second branch');

-- The documented conflict is asserted explicitly: the grant exists, but the
-- owner/admin credit-note trigger still wins at write time.
select pg_temp.expect_fail(
  format($q$insert into public.credit_notes
      (org_id, branch_id, original_sale_id, customer_id, reason, grand_total)
    values (%L, %L, %L, %L, 'rbac conflict probe', 1)$q$,
    (select org_a from _rbac), (select branch_east from _rbac),
    (select sale_id from _rbac), (select customer_id from _rbac)),
  'cashier cannot issue a refund despite credit_notes.issue grant');

select pg_temp.as_user(pg_temp.rbac_uid('org2_owner'));
select pg_temp.expect_rows(
  format('select 1 from public.customers where id = %L', (select customer_id from _rbac)),
  0, 'org B owner cannot read org A customer (IDOR)');
select pg_temp.expect_rows(
  format('select 1 from public.sales where id = %L', (select sale_id from _rbac)),
  0, 'org B owner cannot read org A sale (IDOR)');
select pg_temp.expect_fail(
  format('update public.sales set grand_total = 1 where id = %L',
         (select sale_id from _rbac)),
  'org B owner cannot write org A sale (IDOR)');

select pg_temp.as_user(pg_temp.rbac_uid('owner'));
select pg_temp.expect_rows('select 1 where public.can_write_setting(''branches.gstin'')', 1,
  'owner can write owner-only catalog setting');

reset role;
rollback;
\echo 'ALL NON-OWNER RBAC CHECKS PASSED'
