-- SaaS subscription + platform-scope test. Run against a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f saas_platform.sql
-- Everything runs in one transaction and is rolled back.
-- Branch/seat LIMIT enforcement is tested as the table owner (the trigger does not
-- check the role); RLS / platform scope is tested as an authenticated tenant user.
begin;
create temp table _ids as select gen_random_uuid() org, gen_random_uuid() branch1, gen_random_uuid() branch2,
  gen_random_uuid() u_owner, gen_random_uuid() u_staff, gen_random_uuid() u_platform,
  gen_random_uuid() plan_limited, gen_random_uuid() plan_unlimited;
grant select on _ids to public;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
declare v_state text := null; v_msg text := null;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    v_msg := SQLERRM;
  end;
  -- Only a deliberate subscription-limit refusal (42501) counts. Accepting any
  -- exception would let a NOT NULL violation or a bad column name masquerade as
  -- a passing limit test.
  if v_state is null then
    raise exception 'FAIL (should be blocked): %', label;
  elsif v_state <> '42501' then
    raise exception 'FAIL: % was blocked for the wrong reason (%): %', label, v_state, v_msg;
  end if;
  raise notice 'ok   blocked: %', label;
end $$;
create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;
create or replace function pg_temp.expect_touch(sql text, label text) returns void language plpgsql as $$
declare n int; begin execute sql; get diagnostics n = row_count; if n < 1 then raise exception 'FAIL: % (0 rows touched)', label; end if; raise notice 'ok   %', label; end $$;

-- ══ Enforcement rollout knob (plan 9.5) ══════════════════════════════════════
select pg_temp.expect_rows(
  $q$select 1 from platform_settings where key = 'entitlement_enforcement' and value = '"log"'::jsonb$q$,
  1, 'fresh install ships entitlement enforcement in log-only mode');
select pg_temp.expect_rows(
  $q$select 1 where public.entitlement_enforcement() = 'log'$q$,
  1, 'entitlement_enforcement() resolves to log');
select pg_temp.expect_rows(
  $q$select 1 where public.entitlement_enforcement() <> 'enforce'$q$,
  1, 'log-only is the safe default: anything unknown never fails closed');

-- ══ Trial on signup ══════════════════════════════════════════════════════════
-- Must run before any approved tenant member exists: that is what closes the
-- first-run bootstrap gate in create_organisation(). A brand-new organisation
-- must never land in status 'none', which blocks every write. Picks the first
-- public plan when nothing is active yet, so a fresh install whose plans are
-- still drafts still provisions.
create temp table _signup as select gen_random_uuid() u;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  select u, 'signup@test.dev', now(), '{"is_staff":"true"}'::jsonb from _signup;
select pg_temp.as_user((select u from _signup));
select create_organisation('Trial Org Co', 'Head Office', 'HO');
reset role;
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions s join billing_plans p on p.id = s.plan_id
      where s.org_id = (select id from organizations where name = 'Trial Org Co')
        and s.status = 'trialing' and p.code = 'starter'
        and s.trial_ends_at > now() and s.current_period_end = s.trial_ends_at$q$,
  1, 'new organisation starts on a trialing subscription with a trial end date');
select pg_temp.expect_rows(
  $q$select 1 from jsonb_path_query(
        resolve_entitlements((select id from organizations where name = 'Trial Org Co')),
        '$.features._writes_blocked') s where s = 'true'::jsonb$q$,
  0, 'trialing organisation carries no _writes_blocked flag (writes allowed)');
select pg_temp.expect_rows(
  $q$select 1 from subscription_events e join organizations o on o.id = e.org_id
      where o.name = 'Trial Org Co' and e.event_type = 'subscription.trial_started'$q$,
  1, 'trial start is recorded in subscription_events');
select pg_temp.expect_rows(
  $q$select 1 from profiles p join organizations o on o.id = p.org_id
      where o.name = 'Trial Org Co' and p.role_key = 'owner' and p.is_approved$q$,
  1, 'trial org owner is approved and attached to the new organisation');

-- ══ Tenant fixtures ══════════════════════════════════════════════════════════
insert into organizations (id, name) select org, 'SaaS Test Org' from _ids;
-- is_staff metadata keeps sync_auth_to_customer() from auto-creating a storefront
-- customer for each login, exactly as the ERP signup path does.
insert into auth.users (id, email, raw_user_meta_data)
  select u_owner, 'owner@test.dev', '{"is_staff":"true"}'::jsonb from _ids;
insert into auth.users (id, email, raw_user_meta_data)
  select u_staff, 'staff@test.dev', '{"is_staff":"true"}'::jsonb from _ids;
insert into auth.users (id, email, raw_user_meta_data)
  select u_platform, 'platform@test.dev', '{"is_staff":"true"}'::jsonb from _ids;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_owner, org, null, 'owner', true, 'Owner' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = null, role_key = 'owner', is_approved = true, deactivated = false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_staff, org, null, 'staff', true, 'Staff' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = null, role_key = 'staff', is_approved = true, deactivated = false;

insert into billing_plans (id, code, name, active, price_minor, interval, max_branches, max_employees, features)
  select plan_limited, 'test_limited', 'Test Limited', false, 10000, 'month', 1, 2, '{"pos":true,"lab":"basic"}'::jsonb from _ids;
insert into billing_plans (id, code, name, active, price_minor, interval, max_branches, max_employees, features)
  select plan_unlimited, 'test_unlimited', 'Test Unlimited', false, 0, 'month', null, null, '{"pos":true}'::jsonb from _ids;

-- ══ Entitlements ═════════════════════════════════════════════════════════════
-- No subscription → resolve_entitlements status none (app layer blocks writes)
select pg_temp.expect_rows(
  $q$select 1 from jsonb_path_query(resolve_entitlements((select org from _ids)), '$.status') s where s = '"none"'::jsonb$q$,
  1, 'no subscription resolves to status none');

-- Provision a limited subscription (branch max 1, employee max 2)
insert into org_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
  select org, plan_limited, 'active', now(), now() + interval '1 month' from _ids;

-- Roll the knob to 'enforce' so the checks below assert the real refusal path.
-- Log-only behaviour gets its own section further down.
update platform_settings set value = '"enforce"'::jsonb, updated_at = now()
  where key = 'entitlement_enforcement';
select pg_temp.expect_rows(
  $q$select 1 where public.entitlement_enforcement() = 'enforce'$q$,
  1, 'knob flips to enforce so limits really refuse');

-- ══ Plan limits ══════════════════════════════════════════════════════════════
select pg_temp.expect_touch(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''B1'',''Branch B1'')',
         (select branch1 from _ids), (select org from _ids)),
  'first branch allowed within max_branches=1');
select pg_temp.expect_fail(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''B2'',''Branch B2'')',
         (select branch2 from _ids), (select org from _ids)),
  'second branch blocked by max_branches=1');
select pg_temp.expect_fail(
  format('insert into profiles (id, org_id, role_key, is_approved) values (%L,%L,''staff'',true)',
         gen_random_uuid(), (select org from _ids)),
  'employee seat limit blocks a third staff member');
select pg_temp.expect_rows(
  $q$select 1 from org_usage((select org from _ids)) where metric = 'branches' and value = 1$q$,
  1, 'org_usage reports 1 active branch');

-- Upgrade to unlimited → limits lift
update org_subscriptions set plan_id = (select plan_unlimited from _ids)
  where org_id = (select org from _ids);
select pg_temp.expect_touch(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''B2'',''Branch B2'')',
         (select branch2 from _ids), (select org from _ids)),
  'unlimited plan allows another branch');

-- Expired → entitlements flag writes blocked (app layer enforces)
update org_subscriptions set status = 'expired' where org_id = (select org from _ids);
select pg_temp.expect_rows(
  $q$select 1 from jsonb_path_query(resolve_entitlements((select org from _ids)), '$.features._writes_blocked') s where s = 'true'::jsonb$q$,
  1, 'expired resolves with _writes_blocked');

-- ══ Log-only mode (plan 9.5) ═════════════════════════════════════════════════
-- Same plan limits, opposite behaviour: the over-limit write goes through and
-- leaves a queryable trace, so validation can see exactly what enforcement
-- would have refused before the knob is flipped for good.
create temp table _logids as
  select gen_random_uuid() org, gen_random_uuid() b1, gen_random_uuid() b2, gen_random_uuid() b3;
grant select on _logids to public;
insert into organizations (id, name) select org, 'Log Mode Org' from _logids;
insert into org_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
  select org, (select plan_limited from _ids), 'active', now(), now() + interval '1 month' from _logids;

update platform_settings set value = '"log"'::jsonb, updated_at = now()
  where key = 'entitlement_enforcement';
select pg_temp.expect_rows(
  $q$select 1 where public.entitlement_enforcement() = 'log'$q$,
  1, 'knob can be switched back to log-only');

select pg_temp.expect_touch(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''L1'',''Log B1'')',
         (select b1 from _logids), (select org from _logids)),
  'log-only: first branch sits within max_branches=1');
select pg_temp.expect_touch(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''L2'',''Log B2'')',
         (select b2 from _logids), (select org from _logids)),
  'log-only: over-limit branch is ALLOWED instead of refused');
select pg_temp.expect_rows(
  $q$select 1 from audit_log
      where org_id = (select org from _logids)
        and action = 'ENTITLEMENT_LOG_ONLY'
        and new_data ->> 'limit' = 'branches'
        and (new_data ->> 'max')::int = 1$q$,
  1, 'log-only: the would-be-blocked write is recorded in audit_log');

update platform_settings set value = '"enforce"'::jsonb, updated_at = now()
  where key = 'entitlement_enforcement';
select pg_temp.expect_fail(
  format('insert into branches (id, org_id, code, name) values (%L,%L,''L3'',''Log B3'')',
         (select b3 from _logids), (select org from _logids)),
  'enforce: the same over-limit write is now refused');

-- ══ Platform scope ═══════════════════════════════════════════════════════════
-- A platform admin who is NOT a tenant member can read platform_users but sees
-- zero tenant organisations (separate authorization scope, no implicit access).
insert into platform_users (user_id, email, platform_role, is_active)
  select u_platform, 'platform@test.dev', 'super_admin', true from _ids;
select pg_temp.as_user(u_platform) from _ids;
select pg_temp.expect_rows($q$select 1 from platform_users where email = 'platform@test.dev'$q$, 1, 'platform super admin reads platform_users');
select pg_temp.expect_rows($q$select 1 from organizations$q$, 0, 'platform user sees NO tenant orgs (separate scope)');
select pg_temp.expect_rows(
  $q$select 1 from platform_settings where key = 'entitlement_enforcement'$q$,
  1, 'platform super admin reads the enforcement setting');
reset role;

-- A tenant admin must not read platform settings directly, but still needs the
-- function so assertSubscriptionWritable() can honour the rollout mode.
select pg_temp.as_user(u_owner) from _ids;
select pg_temp.expect_rows($q$select 1 from platform_settings$q$, 0, 'tenant admin cannot read platform settings (RLS)');
select pg_temp.expect_rows(
  $q$select 1 where public.entitlement_enforcement() in ('log', 'enforce')$q$,
  1, 'tenant can call entitlement_enforcement() for the write guard');
reset role;

-- ── Usage snapshots (refresh_subscription_usage, plan §6 /subscription/usage) ──
-- The no-arg scheduler variant and the per-org call both run as the function
-- owner here (no auth.uid()), which is the service-role/cron path.
do $$ declare n int; begin
  n := public.refresh_subscription_usage((select org from _ids));
  if n < 1 then raise exception 'FAIL: usage refresh returned %', n; end if;
  raise notice 'ok   usage refresh snapshots live counts (rows=%)', n;
end $$;
select pg_temp.expect_rows(
  $q$select 1 from subscription_usage where org_id = (select org from _ids) and metric = 'branches'$q$,
  1, 'usage snapshot row written for branches');
do $$ declare before_n int; after_n int; begin
  select count(*) into before_n from subscription_usage where org_id = (select org from _ids);
  perform public.refresh_subscription_usage((select org from _ids));
  select count(*) into after_n from subscription_usage where org_id = (select org from _ids);
  if after_n <> before_n then
    raise exception 'FAIL: usage refresh is not idempotent (% -> %)', before_n, after_n;
  end if;
  raise notice 'ok   usage refresh is idempotent (rows stay %)', after_n;
end $$;
select pg_temp.expect_rows(
  $q$select 1 from (select public.refresh_subscription_usage()) r$q$,
  1, 'scheduler variant refreshes every organisation');

-- Cross-org guard: a signed-in member of another company cannot snapshot ours.
create temp table _uids as select gen_random_uuid() other_org, gen_random_uuid() other_user;
grant select on _uids to public;
insert into organizations (id, name) select other_org, 'Usage Guard Org' from _uids;
insert into auth.users (id, email, email_confirmed_at) select other_user, other_user || '@t.test', now() from _uids;
delete from profiles where id = (select other_user from _uids);
insert into profiles (id, org_id, full_name, role_key, is_approved)
  select other_user, other_org, 'Other Owner', 'owner', true from _uids;
select pg_temp.as_user(other_user) from _uids;
do $$ begin
  begin
    perform public.refresh_subscription_usage((select org from _ids));
  exception when others then
    raise notice 'ok   cross-org usage refresh denied: %', sqlerrm;
    return;
  end;
  raise exception 'FAIL: cross-org usage refresh was allowed';
end $$;
-- ...while their own organisation still refreshes fine.
do $$ declare n int; begin
  n := public.refresh_subscription_usage((select other_org from _uids));
  if n < 1 then raise exception 'FAIL: own-org usage refresh returned %', n; end if;
  raise notice 'ok   own-org usage refresh allowed (rows=%)', n;
end $$;
reset role;

rollback;
\echo 'ALL SAAS PLATFORM CHECKS PASSED'
