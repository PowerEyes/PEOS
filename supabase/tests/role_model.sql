-- Role model expansion test (migration 20261212000000_role_model_expansion).
-- Run against a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f role_model.sql
-- Everything runs in one transaction and is rolled back.
begin;
create temp table _r as
  select gen_random_uuid() org, gen_random_uuid() branch,
         gen_random_uuid() u_owner, gen_random_uuid() u_accountant, gen_random_uuid() u_staff;
grant select on _r to public;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
-- Back to a clean service identity: RESET ROLE plus clearing the transaction-local
-- claims, because set_config(..., true) outlives the role change that followed it.
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claims', '', true);
      perform set_config('request.jwt.claim.sub', '', true); end $$;
create or replace function pg_temp.expect_ok(sql text, label text) returns void language plpgsql as $$
begin execute sql; raise notice 'ok   %', label;
exception when others then raise exception 'FAIL: % (%) — %', label, sqlerrm, sql; end $$;
create or replace function pg_temp.expect_err(sql text, label text) returns void language plpgsql as $$
begin execute sql; raise exception 'FAIL (should be blocked): %', label;
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok   blocked: % (%)', label, sqlerrm; end $$;
create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;

-- ══ Fixtures ════════════════════════════════════════════════════════════════
-- is_staff metadata keeps sync_auth_to_customer() from auto-creating a
-- storefront customer for each login, exactly as the ERP signup path does.
insert into organizations (id, name) select org, 'Role Model Org' from _r;
insert into branches (id, org_id, code, name) select branch, org, 'RM', 'RM Branch' from _r;
insert into auth.users (id, email, raw_user_meta_data) select u_owner, 'rm-owner@test.dev', '{"is_staff":"true"}'::jsonb from _r;
insert into auth.users (id, email, raw_user_meta_data) select u_accountant, 'rm-accountant@test.dev', '{"is_staff":"true"}'::jsonb from _r;
insert into auth.users (id, email, raw_user_meta_data) select u_staff, 'rm-staff@test.dev', '{"is_staff":"true"}'::jsonb from _r;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
  select u_owner, org, null, 'owner', true, 'RM Owner' from _r
  on conflict (id) do update set org_id = excluded.org_id, branch_id = null,
    role_key = 'owner', is_approved = true, deactivated = false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
  select u_accountant, org, branch, 'accountant', true, 'RM Accountant' from _r
  on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id,
    role_key = 'accountant', is_approved = true, deactivated = false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
  select u_staff, org, branch, 'staff', true, 'RM Staff' from _r
  on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id,
    role_key = 'staff', is_approved = true, deactivated = false;
select pg_temp.expect_rows(
  $q$select 1 from profiles where id = (select u_accountant from _r) and role_key = 'accountant'$q$,
  1, 'profiles accepts the accountant role_key');

-- ══ CHECK constraints accept the full role set ══════════════════════════════
select pg_temp.expect_ok(
  $q$with u as (insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'rm-lab@test.dev', '{"is_staff":"true"}'::jsonb) returning id)
    insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
      select u.id, r.org, r.branch, 'lab_technician', true, 'Lab' from u, _r r
      on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id,
        role_key = excluded.role_key, is_approved = true, deactivated = false$q$,
  'profiles accepts lab_technician');
select pg_temp.expect_err(
  $q$with u as (insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'rm-rockstar@test.dev', '{"is_staff":"true"}'::jsonb) returning id)
    insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name)
      select u.id, r.org, r.branch, 'rockstar', true, 'X' from u, _r r
      on conflict (id) do update set role_key = excluded.role_key$q$,
  'profiles rejects an unknown role_key');
select pg_temp.expect_ok(
  $q$insert into role_permissions (org_id, role_key, permission)
       select org, 'cashier', 'crm_manage' from _r$q$,
  'role_permissions accepts a cashier grant row');
select pg_temp.expect_err(
  $q$insert into role_permissions (org_id, role_key, permission)
       select org, 'owner', 'crm_manage' from _r$q$,
  'role_permissions rejects owner grants (owner bypasses has_perm)');
select pg_temp.expect_ok(
  $q$insert into staff_invitations (org_id, email, role_key, branch_id)
       select org, 'rm-invite-check@test.dev', 'optometrist', branch from _r$q$,
  'staff_invitations accepts an optometrist invitation');
select pg_temp.expect_err(
  $q$insert into staff_invitations (org_id, email, role_key, branch_id)
       select org, 'rm-invite-owner@test.dev', 'owner', branch from _r$q$,
  'staff_invitations rejects owner invitations');

-- ══ Default grants: new organisation + backfill of existing ones ════════════
select pg_temp.expect_rows(
  $q$select 1 from role_permissions where org_id = (select org from _r)
       and role_key = 'accountant' and permission = 'finance_view' and allowed$q$,
  1, 'new organisation seeds accountant with finance_view');
select pg_temp.expect_rows(
  $q$select 1 from role_permissions where org_id = (select org from _r)
       and role_key = 'inventory_manager' and permission = 'stock_audit' and allowed$q$,
  1, 'new organisation seeds inventory_manager with stock_audit');
select pg_temp.expect_rows(
  $q$select 1 from role_permissions where org_id = (select org from _r)
       and role_key = 'accountant' and permission = 'crm_manage'$q$,
  0, 'accountant does not inherit branch_manager-only crm_manage');
select pg_temp.expect_rows(
  $q$select 1 from organizations o
       where not exists (select 1 from role_permissions rp
         where rp.org_id = o.id and rp.role_key = 'accountant'
           and rp.permission = 'finance_view' and rp.allowed)$q$,
  0, 'migration backfill granted accountant finance_view in every organisation');

-- ══ has_perm / my_permissions from the user's perspective ═══════════════════
select pg_temp.as_user(u_accountant) from _r;
select pg_temp.expect_rows($q$select 1 where public.has_perm('finance_view')$q$,
  1, 'accountant passes finance_view');
select pg_temp.expect_rows($q$select 1 where not public.has_perm('crm_manage')$q$,
  1, 'accountant fails crm_manage until granted');
select pg_temp.expect_rows($q$select 1 where not public.has_perm('stock_audit')$q$,
  1, 'accountant fails stock_audit (that is inventory_manager’s default)');
select pg_temp.expect_rows(
  $q$select 1 where 'finance_view' = any(public.my_permissions())$q$,
  1, 'my_permissions() exposes finance_view to the accountant');
select pg_temp.as_service();

-- ══ set_role_permission ═════════════════════════════════════════════════════
select pg_temp.as_user(u_owner) from _r;
select pg_temp.expect_ok(
  $q$select public.set_role_permission('accountant', 'crm_manage', true)$q$,
  'owner can grant a specialist role a permission');
select pg_temp.expect_rows(
  $q$select 1 from role_permissions where org_id = (select org from _r)
       and role_key = 'accountant' and permission = 'crm_manage' and allowed$q$,
  1, 'the specialist grant persisted');
select pg_temp.expect_err(
  $q$select public.set_role_permission('owner', 'crm_manage', true)$q$,
  'granting to the owner role is rejected');
select pg_temp.expect_err(
  $q$select public.set_role_permission('chief_wizard', 'crm_manage', true)$q$,
  'granting to an unknown role is rejected');
select pg_temp.expect_err(
  $q$select public.set_role_permission('accountant', 'no_such_permission', true)$q$,
  'granting an unknown permission is rejected');
select pg_temp.as_service();
select pg_temp.as_user(u_staff) from _r;
select pg_temp.expect_err(
  $q$select public.set_role_permission('staff', 'expenses', true)$q$,
  'a non-admin cannot change permissions');
select pg_temp.as_service();

-- ══ invite_staff ════════════════════════════════════════════════════════════
select pg_temp.as_user(u_owner) from _r;
select pg_temp.expect_rows(
  $q$select 1 where public.invite_staff('rm-acct-invite@test.dev', 'accountant', (select branch from _r)) is not null$q$,
  1, 'invite_staff accepts accountant with a branch');
select pg_temp.expect_err(
  $q$select public.invite_staff('rm-nobranch@test.dev', 'accountant', null)$q$,
  'inviting a specialist without a branch is rejected');
select pg_temp.expect_err(
  $q$select public.invite_staff('rm-badrole@test.dev', 'guru', (select branch from _r))$q$,
  'inviting an unknown role is rejected');
select pg_temp.expect_err(
  $q$select public.invite_staff('rm-owner@test.dev2', 'owner', (select branch from _r))$q$,
  'inviting an owner is rejected');
select pg_temp.as_service();

-- ══ admin_update_staff ══════════════════════════════════════════════════════
select pg_temp.as_user(u_owner) from _r;
select pg_temp.expect_ok(
  $q$select public.admin_update_staff((select u_staff from _r), 'receptionist')$q$,
  'owner can move a staff member to a specialist role');
select pg_temp.expect_rows(
  $q$select 1 from profiles where id = (select u_staff from _r) and role_key = 'receptionist'$q$,
  1, 'the specialist role persisted on profiles');
select pg_temp.expect_err(
  $q$select public.admin_update_staff((select u_staff from _r), 'guru')$q$,
  'admin_update_staff rejects an unknown role');
select pg_temp.as_service();

rollback;
