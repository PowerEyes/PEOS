-- End-to-end flow on a scratch DB with all migrations (rolled back):
--   lead -> platform admin converts -> company provisioned (+owner invitation) -> owner claims
--   -> owner invites staff -> catalogue/stock -> storefront order -> ERP advances it -> tenant isolation.
begin;
grant usage on schema public, auth to authenticated, anon; grant all on all sequences in schema public to authenticated; grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant execute on all functions in schema public to authenticated;
create temp table _ids as select gen_random_uuid() org, gen_random_uuid() u_plat, gen_random_uuid() u_owner, gen_random_uuid() u_staff,
  gen_random_uuid() lead, gen_random_uuid() cust, gen_random_uuid() prod, gen_random_uuid() u_other;
grant select on _ids to public;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$ begin if not coalesce(c,false) then raise exception 'FAIL: %', m; end if; raise notice 'ok   %', m; end $$;

insert into auth.users (id,email,email_confirmed_at) select u_plat,'plat@x.test',now() from _ids;
insert into auth.users (id,email,email_confirmed_at) select u_owner,'owner@newco.test',now() from _ids;
insert into auth.users (id,email,email_confirmed_at) select u_staff,'staff@newco.test',now() from _ids;
insert into auth.users (id,email,email_confirmed_at) select u_other,'other@x.test',now() from _ids;
insert into platform_users (user_id,email,platform_role) select u_plat,'plat@x.test','super_admin' from _ids;

-- 1. public plans are readable by anon; a lead is captured (service role path)
update billing_plans set active = true where code = 'starter';
set local role anon;
select pg_temp.ok((select count(*) from public_plans()) >= 1, 'anon can read public plans');
reset role;
insert into saas_leads (id, full_name, business_name, email, branches, status) select lead,'New Owner','NewCo Optical','owner@newco.test',3,'new' from _ids;
select pg_temp.ok((select status from saas_leads where id=(select lead from _ids))='new','lead captured as new');

-- 2. platform admin sees and converts the lead; a tenant user cannot see it
select pg_temp.as_user(u_plat) from _ids;
select pg_temp.ok((select count(*) from saas_leads)=1,'platform admin sees the lead');
update saas_leads set status='converted' where id=(select lead from _ids);
select pg_temp.ok((select status from saas_leads)='converted','platform admin converts lead');
reset role;

-- 3. provisioning (what registerCompanyManual does, service role)
insert into organizations (id,name) select org,'NewCo Optical' from _ids;
insert into branches (org_id,code,name) select org,'HQ','Main Branch' from _ids;
insert into org_subscriptions (org_id,plan_id,status,trial_ends_at,current_period_start)
  select org,(select id from billing_plans order by display_order limit 1),'trialing',now()+interval '14 days',now() from _ids;
insert into staff_invitations (org_id,email,role_key,branch_id,expires_at)
  select org,'owner@newco.test','owner',(select id from branches b where b.org_id=_ids.org order by code limit 1),now()+interval '14 days' from _ids;
select pg_temp.ok((select count(*) from branches where org_id=(select org from _ids))>=1,'new company has a default branch');

-- 4. owner signs in: invitation is claimed and owner is bound to the new org
select pg_temp.as_user(u_owner) from _ids;
select pg_temp.ok(public.claim_invitation(),'owner claims invitation');
select pg_temp.ok(public.current_org()=(select org from _ids),'owner is in the new company');
select pg_temp.ok((select role_key from profiles where id=(select u_owner from _ids))='owner','owner role assigned');
reset role;

-- 5. owner invites staff, who claims it
select pg_temp.as_user(u_owner) from _ids;
select public.invite_staff('staff@newco.test','staff',(select id from branches where org_id=(select org from _ids) limit 1));
reset role;
select pg_temp.as_user(u_staff) from _ids;
select pg_temp.ok(public.claim_invitation(),'staff claims invitation');
reset role;

-- 6. catalogue + stock + customer, then a storefront order (service-role insert as the web app does)
insert into customers (id,org_id,full_name,phone) select cust,org,'Web Buyer','9000011111' from _ids;
insert into products (id,org_id,kind,model,selling_price,tax_pct) select prod,org,'accessory','Case',1180,18 from _ids;
insert into stock (org_id,branch_id,product_id,qty) select org,(select id from branches b where b.org_id=_ids.org limit 1),prod,5 from _ids;
do $$ declare r jsonb; v_sale uuid; v_br uuid; o uuid := (select org from _ids); begin
  select id into v_br from branches where org_id=o limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub',(select u_owner from _ids),'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub',(select u_owner from _ids)::text,true);
  execute 'set local role authenticated';
  r := public.place_sale(jsonb_build_object('kind','order','customer_id',(select cust from _ids),'branch_id',v_br,
     'lines', jsonb_build_array(jsonb_build_object('line_type','product','product_id',(select prod from _ids),'qty',1,'discount_pct',0,'unit_price',1,'tax_pct',0))));
  v_sale := (r->>'id')::uuid;
  execute 'reset role';
  insert into online_payments (org_id,sale_id,customer_id,razorpay_order_id,amount,currency,status) values (o,v_sale,(select cust from _ids),'order_e2e',1180,'INR','paid');
  perform set_config('t.sale', v_sale::text, true);
end $$;
select pg_temp.ok((select grand_total from sales where id=current_setting('t.sale')::uuid)=1180,'storefront order priced server-side (1180)');
select pg_temp.ok((select qty from stock where product_id=(select prod from _ids))=4,'stock decremented by the order');

-- 7. ERP owner advances the web order
select pg_temp.as_user(u_owner) from _ids;
select public.advance_web_order(current_setting('t.sale')::uuid,'delivered');
reset role;
select pg_temp.ok((select status from sales where id=current_setting('t.sale')::uuid)='delivered','ERP marked web order delivered');

-- 8. isolation: other tenants/users never see the new company's data
select pg_temp.as_user(u_other) from _ids;
select pg_temp.ok((select count(*) from sales where org_id=(select org from _ids))=0,'outsider cannot see new company sales');
select pg_temp.ok((select count(*) from saas_leads)=0,'non-platform user cannot read leads');
reset role;
select pg_temp.as_user(u_owner) from _ids;
select pg_temp.ok((select count(*) from sales where org_id<>(select org from _ids))=0,'new owner sees only own company sales');
reset role;
rollback;
