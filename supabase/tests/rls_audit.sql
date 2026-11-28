-- Phase 7 — automated RLS policy audit (plan §4 Phase 7 bullet 5; §10 risk 1).
-- Structural invariants over pg_catalog plus functional cross-tenant probes:
-- the first things a penetration tester tries, asserted on every run.
-- Companion document (manual checklist + findings log):
-- docs/SECURITY_PENTEST_CHECKLIST.md
-- Run: psql -v ON_ERROR_STOP=1 -f rls_audit.sql   (or via tests.ps1)
begin;

create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;

create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
declare ok boolean := false; n int;
begin begin execute sql; get diagnostics n = row_count; ok := n = 0;   -- RLS filters silently: 0 rows also counts as blocked
      exception when others then ok := true; end;
  if not ok then raise exception 'FAIL (should be blocked): %', label; end if; raise notice 'ok   blocked: %', label; end $$;

-- ══ Structural invariants ══════════════════════════════════════════════════
-- 1. Every public table carries RLS. A future table must enable it (or be
--    added to this audit consciously) — never by omission.
select pg_temp.expect_rows(
  $q$select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname not like 'pg\_%'
        and not c.relrowsecurity$q$,
  0, 'every public table has row level security enabled');

-- 2. Service-side tables expose zero policies (deny by design: written and
--    read only through the service role or SECURITY DEFINER functions).
select pg_temp.expect_rows(
  $q$select 1 from pg_policies where schemaname='public'
      and tablename in ('checkout_quotes','counters','rate_limits','platform_admins','break_glass_grants')$q$,
  0, 'service-side tables expose zero policies (checkout_quotes, counters, rate_limits, platform_admins, break_glass_grants)');

-- 3. No catch-all USING/WITH CHECK (true) on a tenant table (has org_id).
select pg_temp.expect_rows(
  $q$select 1 from pg_policies p where p.schemaname='public'
      and exists (select 1 from pg_attribute a
                  where a.attrelid = p.tablename::regclass and a.attname='org_id'
                    and a.attnum>0 and not a.attisdropped)
      and (coalesce(p.qual,'')='true' or coalesce(p.with_check,'')='true')$q$,
  0, 'no catch-all USING/WITH CHECK (true) policy on any tenant table');

-- 4. Platform tables are read-only for platform admins, never tenant-writable.
select pg_temp.expect_rows(
  $q$select 1 from pg_policies where schemaname='public'
      and tablename in ('platform_users','platform_audit_logs','platform_settings','platform_admins')
      and cmd <> 'SELECT'$q$,
  0, 'platform tables expose no tenant write policies');

-- 5. The tenant audit trail is read-only (rows come from triggers/service).
select pg_temp.expect_rows(
  $q$select 1 from pg_policies where schemaname='public'
      and tablename='audit_log' and cmd <> 'SELECT'$q$,
  0, 'audit_log exposes no tenant write policies');

-- 6. Views over tenant data run with the caller's rights.
select pg_temp.expect_rows(
  $q$select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='v'
        and c.relname in ('customer_orders','customer_loyalty_balance','itc_summary','open_po_value','product_review_summary')
        and not (coalesce(c.reloptions::text,'') like '%security_invoker%')$q$,
  0, 'tenant views run with the caller''s rights (security_invoker = true)');

-- 7. The public website views scope themselves with request_org().
select pg_temp.expect_rows(
  $q$select 1 from pg_views where schemaname='public'
      and viewname in ('public_catalog','public_site_settings')
      and definition not ilike '%request_org()%'$q$,
  0, 'public views scope rows with request_org()');

-- 8. Every SECURITY DEFINER function pins its search_path (no hijackable
--    unqualified references).
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and not (coalesce(p.proconfig, array[]::text[])::text like '%search_path%')$q$,
  0, 'every SECURITY DEFINER function pins search_path');

-- 9. Service/scheduler-only RPCs: exact signatures, tenant roles denied and
--    service_role explicitly granted. Name-based loops are deliberately avoided:
--    an overload or a SECURITY INVOKER redefinition must not silently pass.
do $$
declare
  v_sig text;
  v_oid oid;
  v_service_only text[] := array[
    'public.seed_org_permissions(uuid)',
    'public.rate_limit_hit(text, integer, integer)',
    'public.resolve_entitlements(uuid)',
    'public.org_usage(uuid)',
    'public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)',
    'public.run_subscription_lifecycle()',
    'public.platform_billing_identity()',
    'public.backfill_grandfather_subscriptions()',
    'public.refresh_subscription_usage()',
    'public.seed_site_pages(uuid)',
    'public.backup_tables()',
    'public.org_for_host(text)',
    'public.entitlement_log_only(uuid, text, uuid, jsonb)'
  ];
  n int := 0;
begin
  foreach v_sig in array v_service_only loop
    select p.oid into v_oid
      from pg_proc p
     where p.oid = pg_catalog.to_regprocedure(v_sig);

    if v_oid is null then
      raise exception 'FAIL: missing service-only function %', v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute')
       or has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception 'FAIL: % executable by tenant roles', v_sig;
    end if;
    if not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception 'FAIL: % lost service_role EXECUTE', v_sig;
    end if;
    n := n + 1;
  end loop;
  raise notice 'ok   % service-only functions have exact tenant-deny/service-grant grants', n;
end $$;

-- 10. The scheduler-only usage refresh overload stays off-limits (the org-arg
--     overload remains tenant-callable and carries its own cross-org guard).
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='refresh_subscription_usage'
        and pg_get_function_identity_arguments(p.oid) = ''
        and (has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('authenticated', p.oid, 'execute'))$q$,
  0, 'scheduler-only refresh_subscription_usage() is not tenant-callable');
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p
      where p.oid = 'public.refresh_subscription_usage(uuid)'::regprocedure
        and has_function_privilege('authenticated', p.oid, 'execute')$q$,
  1, 'documented exception: refresh_subscription_usage(uuid) stays tenant-callable');

-- 10b. Safe wrappers and the anonymous host resolver must not be over-revoked
--      while closing the raw cross-org RPCs.
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p
      where p.oid in ('public.my_entitlements()'::regprocedure,
                      'public.my_org_usage()'::regprocedure)
        and has_function_privilege('authenticated', p.oid, 'execute')$q$,
  2, 'tenant-safe entitlement/usage wrappers remain callable');
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p
      where p.oid = 'public.resolve_org(text)'::regprocedure
        and has_function_privilege('anon', p.oid, 'execute')$q$,
  1, 'anonymous host resolver remains callable');

-- 11. Drift guard: no policy may depend on a function tenants cannot execute.
select pg_temp.expect_rows(
  $q$select 1 from pg_policies where schemaname='public'
      and (coalesce(qual,'') || coalesce(with_check,'')) ~*
          'resolve_entitlements|org_usage|seed_org_permissions|platform_billing_identity|backfill_grandfather_subscriptions|refresh_subscription_usage|seed_site_pages|backup_tables|org_for_host|entitlement_log_only|my_entitlements|my_org_usage'$q$,
  0, 'no RLS policy depends on a revoked or wrapper function');

-- 11b. Sensitive RPCs must stay SECURITY DEFINER; an invoker redefinition would
--      bypass the definer-owned guards even if the grants still looked correct.
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p
      where p.oid in (
        'public.seed_org_permissions(uuid)'::regprocedure,
        'public.rate_limit_hit(text, integer, integer)'::regprocedure,
        'public.resolve_entitlements(uuid)'::regprocedure,
        'public.org_usage(uuid)'::regprocedure,
        'public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)'::regprocedure,
        'public.run_subscription_lifecycle()'::regprocedure,
        'public.platform_billing_identity()'::regprocedure,
        'public.backfill_grandfather_subscriptions()'::regprocedure,
        'public.refresh_subscription_usage()'::regprocedure
      ) and not p.prosecdef$q$,
  0, 'sensitive RPCs remain SECURITY DEFINER');

-- 11c. No tenant-callable SECURITY DEFINER function may read break-glass grants.
select pg_temp.expect_rows(
  $q$select 1 from pg_proc p
      where p.prosecdef
        and pg_get_functiondef(p.oid) ilike '%break_glass_grants%'
        and (has_function_privilege('anon', p.oid, 'execute')
             or has_function_privilege('authenticated', p.oid, 'execute'))$q$,
  0, 'no tenant-callable SECURITY DEFINER function reads break_glass_grants');

-- ══ Fixtures: two organisations with a sale, a line and loyalty each ══════
create temp table _a as
  select gen_random_uuid() org, gen_random_uuid() ba, gen_random_uuid() user_id,
         gen_random_uuid() cust, gen_random_uuid() sale, gen_random_uuid() prod;
create temp table _b as
  select gen_random_uuid() org, gen_random_uuid() ba, gen_random_uuid() user_id,
         gen_random_uuid() cust, gen_random_uuid() sale, gen_random_uuid() prod;
grant select on _a, _b to public;

insert into organizations (id, name) select org, 'Audit Org A' from _a;
insert into organizations (id, name) select org, 'Audit Org B' from _b;
insert into branches (id, org_id, code, name) select ba, org, 'AUA', 'Audit Branch A' from _a;
insert into branches (id, org_id, code, name) select ba, org, 'AUB', 'Audit Branch B' from _b;
insert into auth.users (id, email) select user_id, 'audit-a@t.test' from _a;
insert into auth.users (id, email) select user_id, 'audit-b@t.test' from _b;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
  select user_id, org, ba, 'owner', true, 'Audit A' from _a
  on conflict (id) do update set org_id=excluded.org_id, branch_id=excluded.branch_id,
    role_key='owner', is_approved=true, deactivated=false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
  select user_id, org, ba, 'owner', true, 'Audit B' from _b
  on conflict (id) do update set org_id=excluded.org_id, branch_id=excluded.branch_id,
    role_key='owner', is_approved=true, deactivated=false;
insert into customers (id, org_id, full_name, phone) select cust, org, 'Audit Customer', '9333333333' from _a;
insert into customers (id, org_id, full_name, phone) select cust, org, 'Audit Customer B', '9333333334' from _b;
insert into products (id, org_id, kind, model, selling_price) select prod, org, 'frame', 'Audit Frame', 1000 from _a;
insert into products (id, org_id, kind, model, selling_price) select prod, org, 'frame', 'Audit Frame B', 1000 from _b;
insert into sales (id, org_id, branch_id, customer_id, grand_total, kind, status)
  select sale, org, ba, cust, 750, 'order', 'draft' from _a;
insert into sales (id, org_id, branch_id, customer_id, grand_total, kind, status)
  select sale, org, ba, cust, 750, 'order', 'draft' from _b;
insert into sale_lines (org_id, sale_id, line_no, line_type, description, qty, unit_price, line_total)
  select org, sale, 1, 'product', 'Frame', 1, 750, 750 from _a;
insert into sale_lines (org_id, sale_id, line_no, line_type, description, qty, unit_price, line_total)
  select org, sale, 1, 'product', 'Frame', 1, 750, 750 from _b;
insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, 100, 'earn' from _a;
insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, 100, 'earn' from _b;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  -- A real role switch: a superuser probe would pass even if service_role had
  -- lost its EXECUTE grant.
  set local role service_role;
end $$;

-- ══ Functional probes — tenant A ═══════════════════════════════════════════
select pg_temp.as_user(user_id) from _a;

-- The view leak: before the fix both rows were visible to either tenant.
select pg_temp.expect_rows($q$select 1 from customer_loyalty_balance$q$, 1,
  'view leak fixed: A sees only its own loyalty balances');
select pg_temp.expect_rows($q$select 1 from customer_orders$q$, 1,
  'view leak fixed: A sees only its own orders');

-- Wrappers: own data, with no cross-org parameter left to abuse.
select pg_temp.expect_rows(
  $q$select 1 from my_entitlements() e where e->>'status' = 'none'$q$, 1,
  'my_entitlements() resolves the caller''s own subscription');
select pg_temp.expect_rows(
  $q$select 1 from my_org_usage() where metric='customers' and value=1$q$, 1,
  'my_org_usage() reports the caller''s own organisation');

-- The raw cross-org RPCs are revoked for tenant roles. Structural invariant 9
-- is authoritative; these probes confirm PostgREST-style calls fail too.
select pg_temp.expect_fail($q$select resolve_entitlements((select org from _b))$q$,
  'raw resolve_entitlements is revoked for tenants');
select pg_temp.expect_fail($q$select 1 from org_usage((select org from _b))$q$,
  'raw org_usage is revoked for tenants');
select pg_temp.expect_fail($q$select seed_org_permissions((select org from _b))$q$,
  'seed_org_permissions is revoked for tenants');
select pg_temp.expect_fail($q$select platform_billing_identity()$q$,
  'platform_billing_identity is revoked for tenants');
select pg_temp.expect_fail(
  $q$select settle_subscription_payment(null, null, null, null, 0, 'razorpay')$q$,
  'settle_subscription_payment is revoked for tenants');
select pg_temp.expect_fail($q$select run_subscription_lifecycle()$q$,
  'lifecycle runner is revoked for tenants');
select pg_temp.expect_fail($q$select rate_limit_hit('audit', 1, 60)$q$,
  'rate_limit_hit is revoked for tenants');
select pg_temp.expect_fail($q$select backfill_grandfather_subscriptions()$q$,
  'grandfather backfill is revoked for tenants');
select pg_temp.expect_fail($q$select refresh_subscription_usage()$q$,
  'scheduler usage refresh is revoked for tenants');
select pg_temp.expect_fail($q$select seed_site_pages((select org from _b))$q$,
  'site-page seeder is revoked for tenants');
select pg_temp.expect_fail($q$select backup_tables()$q$,
  'backup_tables is revoked for tenants');
select pg_temp.expect_fail($q$select org_for_host('b.test')$q$,
  'org_for_host is revoked for tenants');
select pg_temp.expect_fail($q$select entitlement_log_only(null, null, null, null)$q$,
  'entitlement log-only writer is revoked for tenants');

-- Sensitive tables stay invisible even with a direct query.
select pg_temp.expect_fail($q$select 1 from break_glass_grants$q$,
  'break-glass grants invisible to tenants');
select pg_temp.expect_fail($q$select 1 from org_subscriptions$q$,
  'raw subscription rows filtered by RLS for tenants');
select pg_temp.expect_fail($q$select 1 from platform_users$q$,
  'platform users invisible to tenants');

-- ══ Functional probes — anon (the public website surface) ══════════════════
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
-- as_user set request.jwt.claim.sub transaction-locally; clear it so auth.uid()
-- (and therefore current_org()) is genuinely null, as it is for a real anon
-- request in PostgREST.
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

-- Tightened review insert: anon cannot write into another organisation.
select pg_temp.expect_fail(
  format($q$insert into product_reviews (org_id, product_id, reviewer_name, rating)
         values (%L, (select prod from _b), 'Spammer', 1)$q$, (select org from _b)),
  'anon cannot post a review into another organisation');
select pg_temp.expect_fail($q$select 1 from customers$q$,
  'anon sees no customer rows');
select pg_temp.expect_fail($q$select 1 from org_subscriptions$q$,
  'anon sees no subscription rows');

-- ══ Functional probes — service role (platform path must stay intact) ══════
reset role;
select pg_temp.as_service();
select pg_temp.expect_rows($q$select 1 from resolve_entitlements((select org from _b))$q$, 1,
  'service role still resolves any organisation (platform path intact)');
select pg_temp.expect_rows(
  $q$select 1 from org_usage((select org from _b)) where metric='customers' and value=1$q$, 1,
  'service role still reads any organisation''s usage');
select pg_temp.expect_rows(
  $q$select 1 from platform_billing_identity() b
      where (b ->> 'gst_rate_bp')::int = 1800$q$, 1,
  'service role still reads platform billing identity through the audited client path');
select pg_temp.expect_rows($q$select 1 from customer_orders$q$, 2,
  'service role still sees every row through the views');

reset role;
rollback;
\echo 'ALL RLS AUDIT CHECKS PASSED'
