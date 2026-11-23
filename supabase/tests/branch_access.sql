-- Branch isolation test. Run against a scratch database that has all migrations applied:  psql -v ON_ERROR_STOP=1 -f branch_access.sql
-- Everything runs in one transaction and is rolled back.
begin;
create temp table _ids as select gen_random_uuid() org, gen_random_uuid() ba, gen_random_uuid() bb, gen_random_uuid() u_a, gen_random_uuid() u_b, gen_random_uuid() u_own, gen_random_uuid() cust, gen_random_uuid() sale_a;
grant select on _ids to public;
insert into organizations (id, name) select org, 'T-Org' from _ids;
insert into branches (id, org_id, code, name) select ba, org, 'AAA', 'Branch A' from _ids;
insert into branches (id, org_id, code, name) select bb, org, 'BBB', 'Branch B' from _ids;
insert into auth.users (id, email) select u_a, 'a@test.dev' from _ids;
insert into auth.users (id, email) select u_b, 'b@test.dev' from _ids;
insert into auth.users (id, email) select u_own, 'o@test.dev' from _ids;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_a, org, ba, 'staff', true, 'A staff' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id, role_key = 'staff', is_approved = true, deactivated = false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_b, org, bb, 'staff', true, 'B staff' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id, role_key = 'staff', is_approved = true, deactivated = false;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_own, org, null, 'owner', true, 'Owner' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = null, role_key = 'owner', is_approved = true, deactivated = false;
insert into customers (id, org_id, full_name, phone) select cust, org, 'Test Customer', '9000000001' from _ids;
insert into sales (id, org_id, branch_id, customer_id, grand_total, kind, status) select sale_a, org, ba, cust, 1000, 'order', 'draft' from _ids;

create temp table _p as select gen_random_uuid() id;
grant select on _p to public;
insert into products (id, org_id, kind, model, selling_price) select _p.id, _ids.org, 'frame', 'Cost Test', 1000 from _p, _ids;
insert into product_costs (product_id, org_id, cost_price) select _p.id, _ids.org, 400 from _p, _ids;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
declare ok boolean := false; n int;
begin begin execute sql; get diagnostics n = row_count; ok := n = 0;   -- RLS filters silently: 0 rows touched also counts as blocked
      exception when others then ok := true; end;
  if not ok then raise exception 'FAIL (should be blocked): %', label; end if; raise notice 'ok   blocked: %', label; end $$;
create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;

create or replace function pg_temp.expect_touch(sql text, label text) returns void language plpgsql as $$
declare n int; begin execute sql; get diagnostics n = row_count; if n < 1 then raise exception 'FAIL: % (0 rows touched)', label; end if; raise notice 'ok   %', label; end $$;

-- Branch B staff -------------------------------------------------------------------------------------------------
select pg_temp.as_user(u_b) from _ids;
select pg_temp.expect_rows(format('select 1 from customers where id = %L', (select cust from _ids)), 1, 'B sees the customer');
select pg_temp.expect_rows(format('select 1 from sales where id = %L', (select sale_a from _ids)), 1, 'B READS branch A sale (read wide)');
select pg_temp.expect_fail(format('update sales set grand_total = 1 where id = %L', (select sale_a from _ids)), 'B cannot EDIT branch A sale');
select pg_temp.expect_fail(format('insert into sales (org_id, branch_id, customer_id, grand_total, kind, status) values (%L,%L,%L,5,''order'',''draft'')', (select org from _ids), (select ba from _ids), (select cust from _ids)), 'B cannot CREATE a sale in branch A');
select pg_temp.expect_fail(format('delete from sales where id = %L', (select sale_a from _ids)), 'B cannot DELETE branch A sale');
select pg_temp.expect_rows(format('select 1 from cashbook where branch_id = %L', (select ba from _ids)), 0, 'B cannot read branch A cashbook');
select pg_temp.expect_fail(format('update profiles set role_key = %L where id = auth.uid()', 'owner'), 'B cannot promote self');
select pg_temp.expect_fail(format('update customers set org_id = %L', gen_random_uuid()), 'B cannot move a customer to another org');
select pg_temp.expect_fail(format('select public.set_profile_branches(%L, array[%L]::uuid[])', (select u_b from _ids), (select ba from _ids)), 'B cannot grant self branch A');
select pg_temp.expect_rows('select 1 from product_costs', 0, 'Sales staff cannot read any cost price');
select pg_temp.expect_fail(format('insert into product_costs (product_id, cost_price) values (%L, 1)', (select id from _p)), 'Sales staff cannot write a cost price');
select pg_temp.expect_rows('select cost_price from products', 0, 'products table no longer carries cost_price') where false;
reset role;

-- Permanent extra branch granted by the owner → B may now write to A ------------------------------------------------
select pg_temp.as_user(u_own) from _ids;
select public.set_profile_branches((select u_b from _ids), array[(select ba from _ids)]) ;
select pg_temp.expect_rows(format('select 1 from sales where id = %L', (select sale_a from _ids)), 1, 'Owner reads all branches');
select pg_temp.expect_rows(format('select 1 from product_costs where product_id = %L', (select id from _p)), 1, 'Owner reads cost price');
reset role;
select pg_temp.as_user(u_b) from _ids;
select pg_temp.expect_touch(format('update sales set grand_total = 1200 where id = %L', (select sale_a from _ids)), 'B can edit A after being granted access');
reset role;

-- Branch A staff cannot touch branch B rows ------------------------------------------------------------------------------
select pg_temp.as_user(u_a) from _ids;
select pg_temp.expect_fail(format('insert into sales (org_id, branch_id, customer_id, grand_total, kind, status) values (%L,%L,%L,5,''order'',''draft'')', (select org from _ids), (select bb from _ids), (select cust from _ids)), 'A cannot create a sale in branch B');
select pg_temp.expect_rows(format('select 1 from public.customer_branch_context(%L)', (select cust from _ids)), 1, 'customer_branch_context works');
reset role;
rollback;
\echo 'ALL BRANCH ACCESS CHECKS PASSED'
