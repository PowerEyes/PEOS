-- End-to-end RLS / RBAC security tests. Run against a scratch Supabase DB after all migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_branch_rbac.test.sql
-- Everything runs in one transaction and is rolled back. Fixtures are created here (not shipped as app data).
begin;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claims','',true); perform set_config('request.jwt.claim.sub','',true); end $$;
create or replace function pg_temp.fails(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when others then return true; end $$;
create or replace function pg_temp.ok(c boolean, name text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', name; end if; raise notice 'ok - %', name; end $$;

-- fixtures: org A (2 branches), org B (1 branch)
insert into organizations (id,name) values ('aaaaaaaa-0000-0000-0000-00000000000a','Org A'),('bbbbbbbb-0000-0000-0000-00000000000b','Org B');
insert into branches (id,org_id,code,name) values
 ('a1000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','A1','A One'),
 ('a2000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-00000000000a','A2','A Two'),
 ('b1000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000b','B1','B One');
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data,instance_id,aud,role) select u, n||'@t.test', now(), '{"is_staff":"true"}'::jsonb, '00000000-0000-0000-0000-000000000000','authenticated','authenticated'
 from (values ('10000000-0000-0000-0000-000000000001'::uuid,'ownerA'),('10000000-0000-0000-0000-000000000002','adminA'),('10000000-0000-0000-0000-000000000003','mgrA1'),
  ('10000000-0000-0000-0000-000000000004','staffA1'),('10000000-0000-0000-0000-000000000005','staffA2'),('10000000-0000-0000-0000-000000000006','ownerB'),('10000000-0000-0000-0000-000000000007','pending')) v(u,n);
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a', is_approved=true, role_key='owner' where id='10000000-0000-0000-0000-000000000001';
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a', is_approved=true, role_key='admin' where id='10000000-0000-0000-0000-000000000002';
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a', is_approved=true, role_key='branch_manager', branch_id='a1000000-0000-0000-0000-000000000001' where id='10000000-0000-0000-0000-000000000003';
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a', is_approved=true, role_key='staff', branch_id='a1000000-0000-0000-0000-000000000001' where id='10000000-0000-0000-0000-000000000004';
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a', is_approved=true, role_key='staff', branch_id='a2000000-0000-0000-0000-000000000002' where id='10000000-0000-0000-0000-000000000005';
update profiles set org_id='bbbbbbbb-0000-0000-0000-00000000000b', is_approved=true, role_key='owner' where id='10000000-0000-0000-0000-000000000006';
update profiles set org_id='aaaaaaaa-0000-0000-0000-00000000000a' where id='10000000-0000-0000-0000-000000000007';
insert into user_branches (org_id,user_id,branch_id) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001'),
 ('aaaaaaaa-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001'),
 ('aaaaaaaa-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000002');
insert into products (id,org_id,kind,model,selling_price) values ('c0000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-00000000000a','frame','M1',1000);
insert into stock_movements (org_id,branch_id,product_id,delta,reason) values ('aaaaaaaa-0000-0000-0000-00000000000a','a1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',10,'opening');
-- branch-scoped table built with the same mechanism the migration applies
create table public.t_branch_data (id serial primary key, org_id uuid not null, branch_id uuid);
alter table public.t_branch_data enable row level security;
create policy t_org on public.t_branch_data for all using (org_id = public.current_org()) with check (org_id = public.current_org());
grant all on public.t_branch_data to authenticated; grant usage on sequence t_branch_data_id_seq to authenticated;
select public.apply_branch_scope('public.t_branch_data');
insert into t_branch_data (org_id,branch_id) values ('aaaaaaaa-0000-0000-0000-00000000000a','a1000000-0000-0000-0000-000000000001'),('aaaaaaaa-0000-0000-0000-00000000000a','a2000000-0000-0000-0000-000000000002'),('bbbbbbbb-0000-0000-0000-00000000000b','b1000000-0000-0000-0000-000000000001');

-- 1 tenant + branch isolation (read)
select pg_temp.as_user('10000000-0000-0000-0000-000000000004');
select pg_temp.ok((select count(*) from t_branch_data)=1, 'staff A1 sees only branch A1 rows');
select pg_temp.ok((select count(*) from branches)=2, 'staff sees only own org branches');
select pg_temp.ok((select count(*) from stock)=1 , 'staff A1 sees A1 stock');
-- 2 write bypass attempts
select pg_temp.ok(pg_temp.fails($$insert into t_branch_data (org_id,branch_id) values ('aaaaaaaa-0000-0000-0000-00000000000a','a2000000-0000-0000-0000-000000000002')$$), 'staff A1 cannot insert into branch A2');
select pg_temp.ok(pg_temp.fails($$insert into t_branch_data (org_id,branch_id) values ('bbbbbbbb-0000-0000-0000-00000000000b','b1000000-0000-0000-0000-000000000001')$$), 'staff A cannot insert into org B');
select pg_temp.ok(pg_temp.fails($$insert into stock_movements (org_id,branch_id,product_id,delta,reason) values ('aaaaaaaa-0000-0000-0000-00000000000a','a2000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001',5,'adjustment')$$), 'staff A1 cannot move stock in A2 (trigger covers definer paths)');
-- 3 privilege escalation
select pg_temp.ok(pg_temp.fails($$update profiles set role_key='owner' where id=auth.uid()$$), 'staff cannot self-promote by direct UPDATE');
select pg_temp.ok(pg_temp.fails($$select public.approve_staff('10000000-0000-0000-0000-000000000007','staff','{a1000000-0000-0000-0000-000000000001}')$$), 'staff cannot approve staff');
select pg_temp.ok(pg_temp.fails($$select public.invite_staff('x@t.test','staff','{a1000000-0000-0000-0000-000000000001}')$$), 'staff cannot invite');
select pg_temp.ok(pg_temp.fails($$delete from audit_log$$) , 'staff cannot tamper with audit log');
select pg_temp.ok((select count(*) from audit_log)=0, 'staff cannot read audit log');
select pg_temp.ok((select count(*) from staff_invitations)=0, 'staff cannot read invitations');
select pg_temp.ok(pg_temp.fails($$select public.next_code('bbbbbbbb-0000-0000-0000-00000000000b','x','X-')$$), 'cannot bump another org counter');
-- 4 admin / owner
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from t_branch_data)=2, 'company admin sees all branches of own org only');
select pg_temp.ok(pg_temp.fails($$select public.set_staff_role('10000000-0000-0000-0000-000000000004','owner')$$), 'admin cannot grant owner');
select pg_temp.ok(pg_temp.fails($$select public.set_staff_role('10000000-0000-0000-0000-000000000001','staff')$$), 'admin cannot demote owner');
select pg_temp.ok(pg_temp.fails($$select public.set_staff_role('10000000-0000-0000-0000-000000000006','staff')$$), 'admin cannot touch other org user');
select pg_temp.ok(pg_temp.fails($$select public.approve_staff('10000000-0000-0000-0000-000000000007','staff','{b1000000-0000-0000-0000-000000000001}')$$), 'cannot assign a foreign-org branch');
select public.approve_staff('10000000-0000-0000-0000-000000000007','staff','{a2000000-0000-0000-0000-000000000002}');
select pg_temp.as_admin();
select pg_temp.ok((select is_approved and role_key='staff' from profiles where id='10000000-0000-0000-0000-000000000007'), 'admin approved pending staff');
select pg_temp.ok((select count(*) from audit_log where table_name='profiles' and row_id='10000000-0000-0000-0000-000000000007')>0, 'approval is audited');
select pg_temp.ok(pg_temp.fails($$update audit_log set action='x'$$), 'audit log immutable even for postgres');
-- 5 temporary assignment + expiry
select pg_temp.as_user('10000000-0000-0000-0000-000000000003');
select pg_temp.ok(pg_temp.fails($$select public.grant_temp_branch('10000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000002', now()+interval '1 day','cover')$$), 'manager cannot grant a branch they do not hold');
select public.grant_temp_branch('10000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001', now()+interval '1 day','cover leave');
select pg_temp.ok(pg_temp.fails($$select public.grant_temp_branch('10000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001', now()+interval '60 days','x')$$), 'manager grant capped at 30 days');
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select pg_temp.ok((select count(*) from t_branch_data)=2, 'temp assignment grants second branch');
select pg_temp.as_admin();
update user_branches set expires_at = now() - interval '1 minute' where user_id='10000000-0000-0000-0000-000000000005' and kind='temporary';
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select pg_temp.ok((select count(*) from t_branch_data)=1, 'expired temp assignment no longer grants access');
-- 6 transfers
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select public.request_stock_transfer('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','[{"product_id":"c0000000-0000-0000-0000-000000000001","qty":4}]');
select pg_temp.as_user('10000000-0000-0000-0000-000000000004');
select pg_temp.ok(pg_temp.fails($$select public.approve_stock_transfer((select id from stock_transfers limit 1))$$), 'plain staff cannot approve transfer');
select pg_temp.as_user('10000000-0000-0000-0000-000000000003');
select public.approve_stock_transfer((select id from stock_transfers limit 1));
select pg_temp.ok(pg_temp.fails($$select public.receive_stock_transfer((select id from stock_transfers limit 1))$$), 'source manager cannot receive at destination');
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select public.receive_stock_transfer((select id from stock_transfers limit 1));
select pg_temp.as_admin();
select pg_temp.ok((select qty from stock where branch_id='a1000000-0000-0000-0000-000000000001')=6 and (select qty from stock where branch_id='a2000000-0000-0000-0000-000000000002')=4, 'transfer moved stock exactly once');
select pg_temp.as_user('10000000-0000-0000-0000-000000000006');
select pg_temp.ok((select count(*) from stock_transfers)=0 and (select count(*) from t_branch_data)=1, 'org B cannot see org A transfers/data');
-- 7 deactivation
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select public.set_staff_active('10000000-0000-0000-0000-000000000004', false);
select pg_temp.as_user('10000000-0000-0000-0000-000000000004');
select pg_temp.ok((select count(*) from t_branch_data)=0 and public.current_org() is null, 'deactivated user loses all access immediately');
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok(pg_temp.fails($$select public.set_staff_role('10000000-0000-0000-0000-000000000001','admin')$$), 'cannot change own role / last owner protected');
select pg_temp.as_admin();
-- 8 role permissions + tenant resolution (migration 20261122010000)
select pg_temp.as_admin();
insert into site_domains (host, org_id, is_default) values ('a.test','aaaaaaaa-0000-0000-0000-00000000000a',true),('b.test','bbbbbbbb-0000-0000-0000-00000000000b',true) on conflict do nothing;
select pg_temp.ok(public.resolve_org('www.a.test:443')='aaaaaaaa-0000-0000-0000-00000000000a' and public.resolve_org('b.test')='bbbbbbbb-0000-0000-0000-00000000000b', 'host resolves to the right organisation');
select public.seed_org_permissions('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select pg_temp.ok(not public.has_permission('finance.view'), 'plain staff lacks finance.view by default');
select pg_temp.ok(pg_temp.fails($$insert into expenses (org_id) values (public.current_org())$$), 'plain staff cannot write expenses');
select pg_temp.ok(pg_temp.fails($$select public.set_role_permission('staff','finance.view',true)$$), 'staff cannot change role permissions');
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select public.set_role_permission('staff','finance.view',true);
select pg_temp.as_user('10000000-0000-0000-0000-000000000005');
select pg_temp.ok(public.has_permission('finance.view'), 'owner-granted permission takes effect from the database');
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
select pg_temp.ok(pg_temp.fails($$select public.set_role_permission('staff','finance.manage',true)$$), 'company admin cannot edit the permission matrix (owner only)');
select pg_temp.as_admin();
rollback;
