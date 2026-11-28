-- Business-rule test: pricing, GST, stock, discount cap, quantity cap. Run on a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f business_rules.sql   (rolled back at the end)
begin;
-- Supabase grants table access to authenticated by default; plain Postgres does not.
grant usage on schema public, auth to authenticated, anon; grant all on all sequences in schema public to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;
create temp table _ids as select gen_random_uuid() org, gen_random_uuid() br, gen_random_uuid() u_staff, gen_random_uuid() cust, gen_random_uuid() prod;
grant select on _ids to public;
insert into organizations (id, name) select org, 'BR-Org' from _ids;
insert into branches (id, org_id, code, name) select br, org, 'BRA', 'Main' from _ids;
insert into auth.users (id, email) select u_staff, 'br@test.dev' from _ids;
insert into profiles (id, org_id, branch_id, role_key, is_approved, full_name) select u_staff, org, br, 'staff', true, 'S' from _ids
  on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id, role_key = 'staff', is_approved = true, deactivated = false;
insert into customers (id, org_id, full_name, phone) select cust, org, 'C', '9000000009' from _ids;
insert into products (id, org_id, kind, model, selling_price, tax_pct) select prod, org, 'accessory', 'Case', 1180, 18 from _ids;
insert into stock (org_id, branch_id, product_id, qty) select org, br, prod, 5 from _ids;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.fails(sql text, label text) returns void language plpgsql as $$
declare ok boolean := false; begin begin execute sql; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL (should be refused): %', label; end if; raise notice 'ok   refused: %', label; end $$;
create or replace function pg_temp.sale(qty int, disc numeric) returns text language sql as $$
  select (public.place_sale(jsonb_build_object('kind','order','customer_id',(select cust from _ids),'branch_id',(select br from _ids),
    'lines', jsonb_build_array(jsonb_build_object('line_type','product','product_id',(select prod from _ids),'qty',qty,'discount_pct',disc,'unit_price',1,'tax_pct',0)))))::text $$;

select pg_temp.as_user(u_staff) from _ids;
-- 1. Server price wins over the client's (client sent unit_price 1, tax 0): 2 x 1180 incl. 18% = 2360 total, 360 tax.
do $$ declare r jsonb; g numeric; t numeric; begin
  r := pg_temp.sale(2, 0)::jsonb;
  select grand_total, coalesce(cgst_total,0)+coalesce(sgst_total,0)+coalesce(igst_total,0) into g, t from sales where id = (r->>'id')::uuid;
  if g <> 2360 then raise exception 'FAIL grand total % (want 2360)', g; end if;
  if t <> 360 then raise exception 'FAIL tax total % (want 360)', t; end if;
  raise notice 'ok   server-side price and GST (2360 incl. 360 tax)'; end $$;
-- 2. Stock fell from 5 to 3.
do $$ declare q int; begin select qty into q from stock where product_id = (select prod from _ids); if q <> 3 then raise exception 'FAIL stock % (want 3)', q; end if; raise notice 'ok   stock decremented'; end $$;
-- 3. Overselling, over-cap discount and absurd quantity are refused.
select pg_temp.fails('select pg_temp.sale(4, 0)', 'oversell (4 > 3 on hand)');
select pg_temp.fails('select pg_temp.sale(1, 50)', 'staff discount above the cap');
select pg_temp.fails('select pg_temp.sale(1001, 0)', 'quantity above 1000');
select pg_temp.fails('select pg_temp.sale(1, -5)', 'negative discount');
do $$ declare q int; begin select qty into q from stock where product_id = (select prod from _ids); if q <> 3 then raise exception 'FAIL failed sales changed stock (%)', q; end if; raise notice 'ok   failed sales left stock untouched'; end $$;
reset role; update profiles set role_key = 'owner', branch_id = null where id = (select u_staff from _ids); select pg_temp.as_user(u_staff) from _ids;
-- 4. Returns: cumulative cap, restock, and no second full refund.
do $$ declare sid uuid; lid uuid; q int; r jsonb; begin
  select id into sid from sales order by created_at desc limit 1; select id into lid from sale_lines where sale_id = sid;
  perform public.create_credit_note(jsonb_build_object('sale_id', sid, 'reason', 't', 'lines', jsonb_build_array(jsonb_build_object('line_id', lid, 'qty', 1))));
  select qty into q from stock where product_id = (select prod from _ids); if q <> 4 then raise exception 'FAIL restock %', q; end if;
  perform public.create_credit_note(jsonb_build_object('sale_id', sid, 'reason', 't', 'lines', jsonb_build_array(jsonb_build_object('line_id', lid, 'qty', 5))));
  select qty into q from stock where product_id = (select prod from _ids); if q <> 5 then raise exception 'FAIL second return should cap at remaining 1, stock %', q; end if;
  begin perform public.create_credit_note(jsonb_build_object('sale_id', sid, 'reason', 't', 'lines', jsonb_build_array(jsonb_build_object('line_id', lid, 'qty', 1))));
    raise exception 'FAIL third return accepted'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'ok   returns capped across credit notes and restocked'; end $$;
-- 5. Loyalty guards.
insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, 50, 'purchase' from _ids;
select pg_temp.fails('insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, -80, ''redemption'' from _ids', 'redeem more than balance');
select pg_temp.fails('insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, 0, ''manual'' from _ids', 'zero entry');
insert into loyalty_ledger (org_id, customer_id, delta, reason) select org, cust, -20, 'redemption' from _ids;
do $$ begin raise notice 'ok   loyalty balance guard'; end $$;
-- 6. Payroll arithmetic (hand-checked): 15 of 30 days, basic 20000 hra 8000 other 2000, PF 12% of basic, ESI 0.75% of gross, PT 200, other deduction 100.
do $$ declare c record; z record; sal public.salary_structures := jsonb_populate_record(null::public.salary_structures, '{"basic":20000,"hra":8000,"other_allowance":2000,"pf_pct":12,"esi_pct":0.75,"professional_tax":200}'); begin
  select * into c from public.payslip_calc(sal, 30, 15, 100);
  if c.gross <> 15000 or c.pf <> 1200 or c.esi <> 112.50 or c.net <> 13387.50 then raise exception 'FAIL payroll half month: %', c; end if;
  select * into c from public.payslip_calc(sal, 30, 99, 0);   -- paid days capped at days in month
  if c.gross <> 30000 or c.net <> 27175 then raise exception 'FAIL payroll cap: %', c; end if;
  select * into z from public.payslip_calc(sal, 30, 0, 0);    -- no pay, no professional tax, net never negative
  if z.net <> 0 or z.professional_tax <> 0 then raise exception 'FAIL payroll zero: %', z; end if;
  raise notice 'ok   payroll arithmetic'; end $$;
reset role;
rollback;
