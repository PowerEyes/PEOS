-- Phase 1 + Phase 2 settings control-plane checks. Run against a scratch DB with
-- all migrations applied, including 20261229000000_settings_control_plane.sql
-- and 20261231000000_phase2_effective_settings.sql:
--   psql -v ON_ERROR_STOP=1 -f settings_control_plane.sql
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

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
end $$;

-- ── Catalog shape and seeds ──────────────────────────────────────────────────
select pg_temp.expect_rows(
  $q$select 1 from public.setting_definitions
      where key in ('tax.gst_enabled','tax.gstin','sales.max_discount_pct',
                    'sales.quote_valid_days','lab.lead_days','numbering.code_prefixes')$q$,
  6, 'legacy org_settings keys are catalogued');

select pg_temp.expect_rows(
  $q$select 1 from public.setting_definitions where key like 'module.%'$q$,
  21, 'module toggle registry is catalogued');

select pg_temp.expect_rows(
  $q$select 1 from public.setting_definitions where is_public and is_secret$q$,
  0, 'no catalog row is both public and secret');

select pg_temp.expect_rows(
  $q$select 1 from information_schema.role_table_grants
      where table_name = 'setting_definitions' and grantee = 'anon' and privilege_type = 'SELECT'$q$,
  0, 'anon cannot read the settings catalog');

select pg_temp.expect_rows(
  $q$select 1 from pg_policies
      where schemaname = 'public' and tablename = 'setting_definitions'
        and cmd = 'SELECT' and policyname = 'setting_definitions_read'$q$,
  1, 'authenticated users can read the catalog under RLS');

do $$
begin
  begin
    insert into public.setting_definitions
      (key, module, section, label, scope, value_type, default_value, is_public, is_secret)
    values ('test.bad_secret', 'test', 'test', 'Bad', 'org', 'boolean', 'true'::jsonb, true, true);
    raise exception 'FAIL: public+secret catalog row was accepted';
  exception when check_violation then
    raise notice 'ok   public+secret catalog row is rejected';
  end;
end $$;

-- ── Validation helper ────────────────────────────────────────────────────────
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('tax.gst_enabled', 'true'::jsonb)$q$, 1, 'JSON boolean is valid');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('tax.gst_enabled', '"true"'::jsonb)$q$, 1, 'legacy string boolean is valid');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('tax.gst_enabled', '"maybe"'::jsonb)$q$, 0, 'malformed boolean fails validation');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('sales.max_discount_pct', '"12.5"'::jsonb)$q$, 1, 'numeric string is valid');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('tax.default_supply_type', '"interstate"'::jsonb)$q$, 1, 'enum value is valid');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('tax.default_supply_type', '"other"'::jsonb)$q$, 0, 'unknown enum value fails validation');
select pg_temp.expect_rows($q$select 1 where public.validate_setting_value('does.not.exist', 'true'::jsonb)$q$, 0, 'unknown key fails validation');

-- ── Fixtures ─────────────────────────────────────────────────────────────────
create temp table _settings_fixture as
  select gen_random_uuid() as org,
         gen_random_uuid() as owner,
         gen_random_uuid() as admin,
         gen_random_uuid() as manager,
         gen_random_uuid() as staff;
grant select on _settings_fixture to public;

insert into public.organizations (id, name)
select org, 'Settings Test Org' from _settings_fixture;
insert into public.site_domains (host, org_id, is_default)
select 'settings.test', org, false from _settings_fixture;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select u.id, u.email, now(), '{}'::jsonb
from _settings_fixture f
cross join lateral (values
  (f.owner, 'settings-owner@test.dev'),
  (f.admin, 'settings-admin@test.dev'),
  (f.manager, 'settings-manager@test.dev'),
  (f.staff, 'settings-staff@test.dev')
) as u(id, email);
insert into public.profiles (id, org_id, full_name, role_key, is_approved, deactivated)
select u.id, f.org, u.full_name, u.role_key, true, false
from _settings_fixture f
cross join lateral (values
  (f.owner, 'Settings Owner', 'owner'),
  (f.admin, 'Settings Admin', 'admin'),
  (f.manager, 'Settings Manager', 'branch_manager'),
  (f.staff, 'Settings Staff', 'staff')
) as u(id, full_name, role_key);

select set_config('request.headers', '{"x-site-host":"settings.test"}'::text, true);

-- ── Per-key write authority ──────────────────────────────────────────────────
select pg_temp.as_user((select owner from _settings_fixture));
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.gstin')$q$, 1, 'owner can write owner-only branch setting');
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.timezone')$q$, 1, 'owner can write manager-scoped branch setting');
reset role;

select pg_temp.as_user((select admin from _settings_fixture));
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.gstin')$q$, 0, 'admin cannot write owner-only branch setting');
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.timezone')$q$, 1, 'admin can write manager-scoped branch setting');
reset role;

select pg_temp.as_user((select manager from _settings_fixture));
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.gstin')$q$, 0, 'branch manager cannot write owner-only branch setting');
select pg_temp.expect_rows($q$select 1 where public.can_write_setting('branches.timezone')$q$, 1, 'branch manager can write manager-scoped branch setting');
reset role;

-- ── Public projection excludes secrets ───────────────────────────────────────
insert into public.org_settings (org_id, key, value)
select org, 'website.instagram', '"@settingsshop"'::jsonb from _settings_fixture;
insert into public.org_settings (org_id, key, value)
select org, 'integrations.razorpay_key_secret', '"super-secret"'::jsonb from _settings_fixture;

select pg_temp.expect_rows(
  $q$select 1 from public.public_storefront_settings
      where key = 'website.instagram' and value = '"@settingsshop"'::jsonb$q$,
  1, 'public projection exposes allowlisted public value');

select pg_temp.expect_rows(
  $q$select 1 from public.public_storefront_settings
      where key = 'integrations.razorpay_key_secret'$q$,
  0, 'public projection never exposes a secret');

select pg_temp.expect_rows(
  $q$select 1 from public.public_storefront_settings v
      join public.setting_definitions d on d.key = v.key
     where not d.is_public or d.is_secret$q$,
  0, 'public projection contains only public, non-secret keys');

-- ── Audit history view ───────────────────────────────────────────────────────
select pg_temp.as_user((select owner from _settings_fixture));
insert into public.org_settings (org_id, key, value)
select org, 'tax.gstin', '"33AAAAA0000A1Z5"'::jsonb from _settings_fixture;
reset role;

select pg_temp.expect_rows(
  $q$select 1 from public.settings_change_history
      where setting_key = 'tax.gstin' and table_name = 'org_settings'
        and action = 'INSERT' and user_id = (select owner from _settings_fixture)$q$,
  1, 'settings writes appear with the actor in the history view');

select pg_temp.as_user((select staff from _settings_fixture));
select pg_temp.expect_rows(
  $q$select 1 from public.settings_change_history$q$,
  0, 'ordinary staff cannot read the settings history view');
reset role;

-- ── Phase 2 effective settings and numbering ─────────────────────────────────
select pg_temp.as_user((select owner from _settings_fixture));

insert into public.org_settings (org_id, key, value)
select org, 'quotation_valid_days', '21'::jsonb from _settings_fixture;
select pg_temp.expect_rows(
  $q$select 1 where public.effective_setting(
        (select org from _settings_fixture), 'sales.quote_valid_days') = '21'::jsonb$q$,
  1, 'legacy key resolves through the canonical setting');

insert into public.org_settings (org_id, key, value)
select org, 'sales.quote_valid_days', '30'::jsonb from _settings_fixture;
select pg_temp.expect_rows(
  $q$select 1 where public.effective_setting(
        (select org from _settings_fixture), 'quotation_valid_days') = '30'::jsonb$q$,
  1, 'canonical key wins over the legacy key');

update public.org_settings set value = '"oops"'::jsonb
 where org_id = (select org from _settings_fixture) and key = 'sales.quote_valid_days';
select pg_temp.expect_rows(
  $q$select 1 where public.effective_setting(
        (select org from _settings_fixture), 'sales.quote_valid_days') = '14'::jsonb$q$,
  1, 'invalid effective value fails closed to the catalog default');

insert into public.org_settings (org_id, key, value)
select org, 'code_prefixes', '{"customer":"TST-"}'::jsonb from _settings_fixture;
select pg_temp.expect_rows(
  $q$select 1 where public.next_code(
        (select org from _settings_fixture), 'customer', 'CUS-') like 'TST-%'$q$,
  1, 'legacy code_prefixes still drive next_code');

insert into public.org_settings (org_id, key, value)
select org, 'numbering.code_prefixes', '{"customer":"CAN-"}'::jsonb from _settings_fixture;
select pg_temp.expect_rows(
  $q$select 1 where public.next_code(
        (select org from _settings_fixture), 'customer', 'CUS-') like 'CAN-%'$q$,
  1, 'canonical numbering key overrides legacy prefixes');

select pg_temp.expect_error(
  $q$select public.next_code(gen_random_uuid(), 'customer', 'CUS-')$q$,
  'Organisation mismatch', 'next_code rejects a cross-org counter write');

select pg_temp.expect_error(
  $q$select public.next_code((select org from _settings_fixture), 'bad key', 'CUS-')$q$,
  'Invalid code sequence key', 'next_code rejects malformed sequence keys');
reset role;

rollback;
