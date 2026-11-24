-- Platform break-glass test: grants are invisible and untouchable for tenants,
-- reason-scoped, time-bounded and revocable — the database half of acceptance
-- criterion 5 (platform admins see company private records only through an
-- explicit, audited grant). Run against a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f break_glass.sql
-- Everything runs in one transaction and is rolled back.
begin;
create temp table _b as
  select gen_random_uuid() org, gen_random_uuid() u_tenant,
         gen_random_uuid() u_plat, gen_random_uuid() u_other;
grant select on _b to public;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claims', '', true);
      perform set_config('request.jwt.claim.sub', '', true); end $$;
create or replace function pg_temp.expect_err(sql text, label text) returns void language plpgsql as $$
begin execute sql; raise exception 'FAIL (should be blocked): %', label;
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   blocked: % (%)', label, sqlerrm; end $$;
create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;

-- ══ Fixtures ════════════════════════════════════════════════════════════════
insert into organizations (id, name) select org, 'BreakGlass Co' from _b;
insert into auth.users (id, email, raw_user_meta_data)
  select u_tenant, 'bg-tenant@test.dev', '{"is_staff":"true"}'::jsonb from _b;
insert into profiles (id, org_id, role_key, is_approved, full_name)
  select u_tenant, org, 'owner', true, 'BG Tenant' from _b
  on conflict (id) do update set org_id = excluded.org_id, role_key = 'owner',
    is_approved = true, deactivated = false;
-- company-private data the platform must not see without a grant
insert into customers (org_id, full_name, phone) select org, 'Private Patient', '9999999999' from _b;

-- three grants: A live (u_plat), B default TTL (u_other), C already expired (u_plat)
insert into break_glass_grants (org_id, platform_user_id, reason, expires_at)
  select org, u_plat, 'Support ticket #42 - duplicate imports', now() + interval '30 minutes' from _b;
insert into break_glass_grants (org_id, platform_user_id, reason)
  select org, u_other, 'Default TTL grant reason' from _b;
insert into break_glass_grants (org_id, platform_user_id, reason, granted_at, expires_at)
  select org, u_plat, 'Expired grant reason', now() - interval '2 hours', now() - interval '90 minutes' from _b;

-- ══ Tenants can neither read nor mint grants ════════════════════════════════
select pg_temp.as_user(u_tenant) from _b;
select pg_temp.expect_err(
  $q$select 1 from break_glass_grants$q$,
  'tenant cannot read the grants table');
select pg_temp.expect_err(
  $q$insert into break_glass_grants (org_id, platform_user_id, reason)
       select org, u_plat, 'tenant mints their own grant here' from _b$q$,
  'tenant cannot mint a grant');
select pg_temp.expect_err(
  $q$update break_glass_grants set revoked_at = now(), reason = 'rewrite the audit trail'$q$,
  'tenant cannot rewrite or revoke grants');
select pg_temp.as_service();

-- ══ Reason-scoped and time-bounded in the database ═════════════════════════
select pg_temp.expect_err(
  $q$insert into break_glass_grants (org_id, platform_user_id, reason)
       select org, u_plat, 'short' from _b$q$,
  'a reason shorter than 10 characters is rejected');
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants
       where reason = 'Support ticket #42 - duplicate imports' and revoked_at is null$q$,
  1, 'the live grant is intact for the service role');

-- the exact gate /platform/companies/[id]/records uses, evaluated per user:
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants
       where org_id = (select org from _b) and platform_user_id = (select u_plat from _b)
         and revoked_at is null and expires_at > now()$q$,
  1, 'an active grant unlocks records for its own platform user');
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants
       where org_id = (select org from _b) and platform_user_id = (select u_other from _b)
         and revoked_at is null and expires_at > now()$q$,
  1, 'each platform user has their own grant - access is per-user');
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants
       where org_id = (select org from _b) and platform_user_id = (select u_tenant from _b)
         and revoked_at is null and expires_at > now()$q$,
  0, 'a user without a grant is refused');
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants where reason = 'Default TTL grant reason'
         and expires_at > now() and expires_at <= now() + interval '31 minutes'$q$,
  1, 'grants default to a 30-minute expiry');
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants where reason = 'Expired grant reason'
         and revoked_at is null and expires_at > now()$q$,
  0, 'an expired grant does not unlock records');

-- ══ Revocation ends access immediately ══════════════════════════════════════
update break_glass_grants set revoked_at = now()
  where reason = 'Support ticket #42 - duplicate imports';
select pg_temp.expect_rows(
  $q$select 1 from break_glass_grants
       where org_id = (select org from _b) and platform_user_id = (select u_plat from _b)
         and revoked_at is null and expires_at > now()$q$,
  0, 'after revocation the gate refuses again');

rollback;
