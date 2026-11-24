-- Company-side support access test: support_tickets tenant isolation,
-- announcement visibility and the ticket rate limiter.
-- Run against a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f support_access.sql
-- Everything runs in one transaction and is rolled back.
begin;
create temp table _s as
  select gen_random_uuid() org_a, gen_random_uuid() org_b,
         gen_random_uuid() u_a, gen_random_uuid() u_b;
grant select on _s to public;
create temp table _rl as select 'support_rl:' || gen_random_uuid() k;
grant select on _rl to public;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
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
insert into organizations (id, name) select org_a, 'Support Org A' from _s;
insert into organizations (id, name) select org_b, 'Support Org B' from _s;
insert into auth.users (id, email, raw_user_meta_data) select u_a, 'sup-a@test.dev', '{"is_staff":"true"}'::jsonb from _s;
insert into auth.users (id, email, raw_user_meta_data) select u_b, 'sup-b@test.dev', '{"is_staff":"true"}'::jsonb from _s;
insert into profiles (id, org_id, role_key, is_approved, full_name)
  select u_a, org_a, 'owner', true, 'Support A' from _s
  on conflict (id) do update set org_id = excluded.org_id, role_key = 'owner',
    is_approved = true, deactivated = false;
insert into profiles (id, org_id, role_key, is_approved, full_name)
  select u_b, org_b, 'owner', true, 'Support B' from _s
  on conflict (id) do update set org_id = excluded.org_id, role_key = 'owner',
    is_approved = true, deactivated = false;
insert into support_tickets (org_id, subject) select org_a, 'A existing ticket' from _s;
insert into support_tickets (org_id, subject) select org_b, 'B existing ticket' from _s;
insert into announcements (title, body, target) values ('Platform notice', 'Everything is fine', 'all');

-- ══ Tenant reads: own rows only ═════════════════════════════════════════════
select pg_temp.as_user(u_a) from _s;
select pg_temp.expect_rows(
  $q$select 1 from support_tickets where subject = 'A existing ticket'$q$,
  1, 'tenant sees their own ticket');
select pg_temp.expect_rows(
  $q$select 1 from support_tickets where subject = 'B existing ticket'$q$,
  0, 'tenant cannot see another company ticket');
select pg_temp.expect_rows(
  $q$select 1 from announcements where title = 'Platform notice'$q$,
  1, 'platform announcements are readable by tenants');

-- ══ Tenant writes: own org only ═════════════════════════════════════════════
select pg_temp.expect_ok(
  $q$insert into support_tickets (org_id, subject, priority)
       select org_a, 'Raised by A', 'urgent' from _s$q$,
  'a member can open a ticket for their own company');
select pg_temp.expect_rows(
  $q$select 1 from support_tickets where subject = 'Raised by A' and org_id = (select org_a from _s)$q$,
  1, 'the new ticket landed in the right organisation');
select pg_temp.expect_err(
  $q$insert into support_tickets (org_id, subject)
       select org_b, 'Injected by A' from _s$q$,
  'a member cannot open a ticket against another company');
select pg_temp.as_service();

-- ══ Rate limiter: allows the first N, then refuses ═════════════════════════
-- EXECUTE on rate_limit_hit is deliberately service-role only (migration
-- 20261123000000 revoked it from anon/authenticated/public): tenants reach it
-- through server actions that use the service client.
set local role service_role;
select pg_temp.expect_rows(
  $q$select 1 where public.rate_limit_hit((select k from _rl), 3, 3600)$q$,
  1, '1st ticket within the hourly limit');
select pg_temp.expect_rows(
  $q$select 1 where public.rate_limit_hit((select k from _rl), 3, 3600)$q$,
  1, '2nd ticket within the hourly limit');
select pg_temp.expect_rows(
  $q$select 1 where public.rate_limit_hit((select k from _rl), 3, 3600)$q$,
  1, '3rd ticket at the hourly limit');
select pg_temp.expect_rows(
  $q$select 1 where public.rate_limit_hit((select k from _rl), 3, 3600)$q$,
  0, '4th ticket refused once the limit is exceeded');
select pg_temp.as_service();

rollback;
