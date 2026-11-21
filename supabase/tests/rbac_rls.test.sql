-- Run against a migrated database:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rbac_rls.test.sql
-- Everything runs in one transaction and rolls back. Raises on the first failed assertion.
begin;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
create or replace function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', msg; end if; end $$;
create or replace function pg_temp.n(q text) returns bigint language plpgsql as $$ declare r bigint; begin execute q into r; return r; end $$;

do $$
declare
  o1 uuid := '00000000-0000-0000-0000-000000000001'; o2 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); b3 uuid := gen_random_uuid();
  owner1 uuid := gen_random_uuid(); adm1 uuid := gen_random_uuid(); mgr1 uuid := gen_random_uuid(); st1 uuid := gen_random_uuid(); st2 uuid := gen_random_uuid(); own2 uuid := gen_random_uuid();
  prod uuid; tr uuid; asg uuid; k int;
begin
  insert into organizations (id, name) values (o1, 'Org One') on conflict do nothing;
  insert into organizations (id, name) values (o2, 'Org Two');
  insert into branches (id, org_id, code, name) values (b1, o1, 'T1', 'T Branch 1'), (b2, o1, 'T2', 'T Branch 2'), (b3, o2, 'T3', 'T Branch 3');
  insert into auth.users (id, email, email_confirmed_at) select u, u || '@t.test', now() from unnest(array[owner1, adm1, mgr1, st1, st2, own2]) u;
  delete from profiles where id in (owner1, adm1, mgr1, st1, st2, own2);
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved) values
    (owner1, o1, 'Owner', 'owner', b1, true), (adm1, o1, 'Admin', 'admin', b1, true), (mgr1, o1, 'Mgr', 'branch_manager', b1, true),
    (st1, o1, 'Staff1', 'staff', b1, true), (st2, o1, 'Staff2', 'staff', b2, true), (own2, o2, 'Owner2', 'owner', b3, true);
  insert into products (org_id, kind, model, selling_price) values (o1, 'frame', 'T-Frame', 100) returning id into prod;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason) values (o1, b1, prod, 10, 'opening');
  insert into expenses (org_id, branch_id, category, description, amount) values (o1, b1, 'rent', 'b1 rent', 5), (o1, b2, 'rent', 'b2 rent', 5);

  -- 1 tenant isolation
  perform pg_temp.as_user(own2);
  perform pg_temp.ok(pg_temp.n('select count(*) from products') = 0, 'org2 must not see org1 products');
  perform pg_temp.ok(pg_temp.n('select count(*) from branches') = 1, 'org2 sees only its own branch');
  perform pg_temp.as_admin();

  -- 2 branch scoping + finance visibility
  perform pg_temp.as_user(st1);
  perform pg_temp.ok(pg_temp.n('select count(*) from stock_movements') = 1, 'staff1 sees own branch movements only');
  perform pg_temp.ok(pg_temp.n('select count(*) from expenses') = 0, 'plain staff must not read finance');
  perform pg_temp.ok(pg_temp.fails(format('insert into stock_movements (branch_id, product_id, delta, reason) values (%L, %L, 1, ''adjustment'')', b2, prod)), 'staff1 must not write branch 2');
  perform pg_temp.as_user(mgr1);
  perform pg_temp.ok(pg_temp.n('select count(*) from expenses') = 1, 'manager sees only own-branch expenses');
  perform pg_temp.as_user(adm1);
  perform pg_temp.ok(pg_temp.n('select count(*) from expenses') = 2, 'admin sees all branches in org');

  -- 3 privilege escalation
  perform pg_temp.as_user(st1);
  perform pg_temp.ok(pg_temp.fails(format('update profiles set role_key = ''owner'' where id = %L', st1)), 'direct profile update must be denied');
  perform pg_temp.ok(pg_temp.fails(format('select admin_update_staff(%L, ''owner'')', st1)), 'staff cannot call admin_update_staff');
  perform pg_temp.ok(pg_temp.fails(format('select invite_staff(''x@y.com'', ''staff'', %L)', b1)), 'staff cannot invite');
  perform pg_temp.as_user(adm1);
  perform pg_temp.ok(pg_temp.fails(format('select admin_update_staff(%L, ''staff'')', owner1)), 'admin cannot touch an owner');
  perform pg_temp.ok(pg_temp.fails(format('select admin_update_staff(%L, ''admin'')', st1)), 'admin cannot grant admin');
  perform pg_temp.as_user(owner1);
  perform pg_temp.ok(pg_temp.fails(format('select admin_update_staff(%L, ''staff'')', owner1)), 'cannot demote yourself / last owner');
  perform admin_update_staff(mgr1, 'branch_manager', b2, true, null);
  perform pg_temp.ok((select branch_id from profiles where id = mgr1) = b2, 'owner can reassign branch');
  perform admin_update_staff(mgr1, null, b1, true, null);

  -- 4 temporary assignment
  perform pg_temp.as_user(st2);
  perform pg_temp.ok(pg_temp.n('select count(*) from expenses') = 0, 'st2 baseline');
  perform pg_temp.ok(pg_temp.fails(format('select assign_temp_branch(%L, %L, now() + interval ''1 day'', ''x'')', st2, b1)), 'staff cannot self-assign');
  perform pg_temp.as_user(mgr1);
  asg := assign_temp_branch(st2, b1, now() + interval '2 days', 'cover leave');
  perform pg_temp.ok(pg_temp.fails(format('select assign_temp_branch(%L, %L, now() + interval ''200 days'', ''too long'')', st2, b1)), '90-day cap');
  perform pg_temp.as_user(st2);
  perform pg_temp.ok(pg_temp.n('select count(*) from stock_movements') = 1, 'temp assignment grants branch 1 access');
  perform pg_temp.as_user(mgr1); perform revoke_temp_assignment(asg);
  perform pg_temp.as_user(st2);
  perform pg_temp.ok(pg_temp.n('select count(*) from stock_movements') = 0, 'revocation removes access immediately');

  -- 5 transfers
  perform pg_temp.as_user(st2); tr := request_transfer(b1, b2, prod, 4, 'test');
  perform pg_temp.ok(pg_temp.fails(format('select approve_transfer(%L)', tr)), 'receiving-branch staff cannot approve');
  perform pg_temp.as_user(mgr1); perform approve_transfer(tr);
  perform pg_temp.as_admin(); perform pg_temp.ok((select qty from stock where branch_id = b1 and product_id = prod) = 6, 'source stock deducted');
  perform pg_temp.as_user(st1); perform pg_temp.ok(pg_temp.fails(format('select receive_transfer(%L)', tr)), 'sending branch cannot confirm receipt');
  perform pg_temp.as_user(st2); perform receive_transfer(tr);
  perform pg_temp.as_admin(); perform pg_temp.ok((select qty from stock where branch_id = b2 and product_id = prod) = 4, 'dest stock added');
  perform pg_temp.as_user(st2); perform pg_temp.ok(pg_temp.fails(format('select receive_transfer(%L)', tr)), 'no double receive');

  -- 6 deactivation is immediate
  perform pg_temp.as_user(owner1); perform admin_update_staff(st1, null, null, false, true);
  perform pg_temp.as_user(st1);
  perform pg_temp.ok(pg_temp.n('select count(*) from stock_movements') = 0, 'deactivated user sees nothing');

  -- 7 audit trail
  perform pg_temp.as_admin();
  perform pg_temp.ok((select count(*) from audit_log where table_name in ('profiles', 'staff_assignments', 'branch_transfers')) > 0, 'permission/assignment/transfer changes audited');
  perform pg_temp.ok(pg_temp.fails('delete from audit_log'), 'audit_log is append-only');

  -- 8 configurable permissions, export audit, domains, rate limit
  perform pg_temp.as_user(st1); perform pg_temp.ok(not has_perm('finance_view'), 'staff denied finance by default');
  perform pg_temp.as_user(mgr1); perform pg_temp.ok(has_perm('finance_view'), 'manager allowed finance by default');
  perform pg_temp.ok(pg_temp.fails($q$select set_role_permission('staff', 'finance_view', true)$q$), 'manager cannot change permissions');
  perform pg_temp.as_user(owner1); perform set_role_permission('staff', 'expenses', true); perform set_role_permission('branch_manager', 'finance_view', false);
  perform pg_temp.as_user(st2); perform pg_temp.ok(has_perm('expenses'), 'owner can grant staff a permission');
  perform pg_temp.as_user(mgr1); perform pg_temp.ok(not has_perm('finance_view'), 'owner can revoke a manager permission');
  perform pg_temp.ok(pg_temp.n('select count(*) from cashbook') = 0, 'cashbook hidden once permission removed');
  perform pg_temp.as_user(mgr1); perform log_export('test.csv', 3);
  perform pg_temp.as_admin(); perform pg_temp.ok((select count(*) from audit_log where action = 'EXPORT' and table_name = 'test.csv') = 1, 'export audited');
  perform pg_temp.as_user(owner1); perform add_org_domain('t-' || replace(gen_random_uuid()::text, '-', '') || '.example.com');
  perform pg_temp.as_user(adm1); perform pg_temp.ok(pg_temp.fails($q$select add_org_domain('not a domain')$q$), 'invalid domain rejected');
  perform pg_temp.as_user(st2); perform pg_temp.ok(pg_temp.fails($q$select add_org_domain('x.example.com')$q$), 'staff cannot add domains');
  perform pg_temp.as_admin();
  perform pg_temp.ok(rate_limit_hit('t:' || o1, 2, 60) and rate_limit_hit('t:' || o1, 2, 60) and not rate_limit_hit('t:' || o1, 2, 60), 'rate limit blocks 3rd hit');
  perform pg_temp.as_user(st1); perform pg_temp.ok(pg_temp.fails($q$select rate_limit_hit('x', 1, 60)$q$), 'rate limiter not callable by users');
  raise notice 'ALL RBAC/RLS TESTS PASSED';
end $$;
rollback;
