-- Staging verification for the Phase 2 place_sale hardening.
--
-- Apply the full migration stream to a disposable/cloned database first, then:
--   psql -v ON_ERROR_STOP=1 -f place_sale_staging.sql
--
-- Every check runs inside one transaction and is rolled back. Do not run this
-- against a live or production database. Concurrency is verified by checking
-- that the transaction actually owns the replay advisory lock; a true two-session
-- race still needs the separate two-psql-session checklist in
-- docs/PHASE2_6_PRODUCTION_READINESS_ROADMAP.md.

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

create or replace function pg_temp.as_user(u uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  set local role authenticated;
end $$;

create or replace function pg_temp.as_service()
returns void language plpgsql as $$
begin
  -- A service-role caller deliberately has no profile/session org. The org must
  -- come from p.org_id and must be written explicitly to every child row.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '11111111-2222-3333-4444-555555555555',
                      'role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', '11111111-2222-3333-4444-555555555555', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  set local role service_role;
end $$;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
create temp table _ps_fixture as
select gen_random_uuid() as org,
       gen_random_uuid() as other_org,
       gen_random_uuid() as owner,
       gen_random_uuid() as staff,
       gen_random_uuid() as customer,
       gen_random_uuid() as other_customer,
       gen_random_uuid() as branch,
       gen_random_uuid() as other_branch,
       gen_random_uuid() as product,
       gen_random_uuid() as lens;
grant select on _ps_fixture to public;

insert into public.organizations (id, name)
select org, 'Place Sale Test Org' from _ps_fixture
union all
select other_org, 'Place Sale Other Org' from _ps_fixture;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select u.id, u.email, now(), '{}'::jsonb
from _ps_fixture f
cross join lateral (values
  (f.owner, 'place-sale-owner@test.dev'),
  (f.staff, 'place-sale-staff@test.dev')
) as u(id, email);

insert into public.profiles (id, org_id, full_name, role_key, is_approved, deactivated)
select f.owner, f.org, 'Place Sale Owner', 'owner', true, false from _ps_fixture f
union all
select f.staff, f.org, 'Place Sale Staff', 'staff', true, false from _ps_fixture f;

insert into public.branches (id, org_id, code, name)
select f.branch, f.org, 'PS-MAIN', 'Place Sale Main' from _ps_fixture f
union all
select f.other_branch, f.other_org, 'PS-OTHER', 'Place Sale Other' from _ps_fixture f;

insert into public.customers (id, org_id, branch_id, full_name, phone)
select f.customer, f.org, f.branch, 'Place Sale Customer', '9100000001' from _ps_fixture f
union all
select f.other_customer, f.other_org, f.other_branch, 'Other Org Customer', '9100000002' from _ps_fixture f;

insert into public.products (id, org_id, kind, model, selling_price, tax_pct, hsn)
select f.product, f.org, 'accessory', 'Test Accessory', 100, 18, '900190' from _ps_fixture f;

insert into public.stock (org_id, branch_id, product_id, qty)
select f.org, f.branch, f.product, 100 from _ps_fixture f;

insert into public.lens_packages (org_id, code, name, design, base_price, tax_pct)
select f.org, 'PS-LENS', 'Test Lens', 'single_vision', 1000, 5 from _ps_fixture f;

insert into public.prescriptions
  (org_id, branch_id, customer_id, rx_date, valid_till, status, review_status, approved_by, approved_at)
select f.org, f.branch, f.customer, now(), current_date + 30, 'active', 'approved', f.owner, now()
from _ps_fixture f;

insert into public.org_settings (org_id, key, value)
select org, 'gst_enabled', 'true'::jsonb from _ps_fixture
union all select org, 'max_staff_discount_pct', '5'::jsonb from _ps_fixture
union all select org, 'quotation_valid_days', '7'::jsonb from _ps_fixture
union all select org, 'lab_lead_days', '3'::jsonb from _ps_fixture
union all select org, 'default_supply_type', '"intrastate"'::jsonb from _ps_fixture
union all select org, 'default_state_of_supply', '"Maharashtra"'::jsonb from _ps_fixture;

-- ── GST and supply defaults come from settings ───────────────────────────────
select pg_temp.as_user((select owner from _ps_fixture));

select place_sale(jsonb_build_object(
  'kind', 'order',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 2)),
  'payment', jsonb_build_object('amount', 200, 'method', 'cash')
));

select pg_temp.expect_rows($q$
  select 1 from public.sales s
   join public.sale_lines l on l.sale_id = s.id
  where s.org_id = (select org from _ps_fixture)
    and s.gst_applied
    and s.supply_type = 'intrastate'
    and s.state_of_supply = 'Maharashtra'
    and l.hsn = '900190'
    and l.cgst_amt > 0 and l.sgst_amt > 0
    and (l.cgst_amt + l.sgst_amt) = s.tax_included
$q$, 1, 'GST split and HSN snapshot are stored from org settings');

-- ── Quotation validity comes from settings ──────────────────────────────────
select place_sale(jsonb_build_object(
  'kind', 'quotation',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1))
));

select pg_temp.expect_rows($q$
  select 1 from public.sales
  where org_id = (select org from _ps_fixture)
    and kind = 'quotation'
    and valid_until = current_date + 7
$q$, 1, 'quotation_valid_days setting drives valid_until');

-- ── Lab due date comes from settings ────────────────────────────────────────
select place_sale(jsonb_build_object(
  'kind', 'order',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'prescription_id', (select id from public.prescriptions
                       where org_id = (select org from _ps_fixture) limit 1),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'lens', 'lens_package_id', (select lens from _ps_fixture)))
));

select pg_temp.expect_rows($q$
  select 1 from public.lab_orders
  where org_id = (select org from _ps_fixture)
    and due_date = current_date + 3
$q$, 1, 'lab_lead_days setting drives lab due_date');

-- ── Discount cap: staff blocked, owner/admin allowed ────────────────────────
reset role;
select pg_temp.as_user((select staff from _ps_fixture));
select pg_temp.expect_error($q$
  select place_sale(jsonb_build_object(
    'kind', 'order',
    'customer_id', (select customer from _ps_fixture),
    'branch_id', (select branch from _ps_fixture),
    'lines', jsonb_build_array(jsonb_build_object(
      'line_type', 'product', 'product_id', (select product from _ps_fixture),
      'qty', 1, 'discount_pct', 10))
  ))
$q$, 'need an owner or admin', 'staff discount above max_discount_pct is rejected');

reset role;
select pg_temp.as_user((select owner from _ps_fixture));
select place_sale(jsonb_build_object(
  'kind', 'order',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'product', 'product_id', (select product from _ps_fixture),
    'qty', 1, 'discount_pct', 10))
));

-- ── Idempotent replay and advisory lock ─────────────────────────────────────
select pg_temp.expect_rows($q$
  select 1 from public.sales
  where org_id = (select org from _ps_fixture)
    and grand_total < 100
    and discount_total > 0
$q$, 1, 'owner discount override was applied to the order');

select place_sale(jsonb_build_object(
  'kind', 'order',
  'idempotency_key', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1))
));

select pg_temp.expect_rows($q$
  select 1 where (
    select result->>'idempotent'
    from (
      select place_sale(jsonb_build_object(
        'kind', 'order',
        'idempotency_key', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'customer_id', (select customer from _ps_fixture),
        'branch_id', (select branch from _ps_fixture),
        'lines', jsonb_build_array(jsonb_build_object(
          'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1))
      )) as result
    ) r
  )::boolean
$q$, 1, 'idempotent replay returns the original sale');

select pg_temp.expect_rows($q$
  select 1 from public.sales
  where org_id = (select org from _ps_fixture)
    and idempotency_key = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
$q$, 1, 'idempotent replay created exactly one sale');

select pg_temp.expect_rows($q$
  select 1 where not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      (select org::text from _ps_fixture) || 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 0))
$q$, 1, 'replay path holds the advisory lock for the idempotency key');

-- ── Old invoices are immutable when settings change ─────────────────────────
update public.org_settings set value = 'false'::jsonb
 where org_id = (select org from _ps_fixture) and key = 'gst_enabled';
update public.org_settings set value = '30'::jsonb
 where org_id = (select org from _ps_fixture) and key = 'quotation_valid_days';

select pg_temp.expect_rows($q$
  select 1 from public.sales s
   join public.sale_lines l on l.sale_id = s.id
  where s.org_id = (select org from _ps_fixture)
    and s.gst_applied
    and l.cgst_amt > 0
$q$, 1, 'changing tax settings does not rewrite an existing invoice snapshot');

-- ── Cross-org ids are rejected ──────────────────────────────────────────────
select pg_temp.expect_error($q$
  select place_sale(jsonb_build_object(
    'kind', 'order',
    'customer_id', (select other_customer from _ps_fixture),
    'branch_id', (select other_branch from _ps_fixture),
    'lines', jsonb_build_array(jsonb_build_object(
      'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1))
  ))
$q$, 'Choose a customer', 'cross-org customer/branch is rejected');

select pg_temp.expect_error($q$
  select place_sale(jsonb_build_object(
    'kind', 'order',
    'org_id', (select other_org from _ps_fixture),
    'customer_id', (select customer from _ps_fixture),
    'branch_id', (select branch from _ps_fixture),
    'lines', jsonb_build_array(jsonb_build_object(
      'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1))
  ))
$q$, 'Organisation mismatch', 'session org cannot be overridden by p.org_id');

-- ── Storefront service-role call binds p.org_id to every row ────────────────
reset role;
select pg_temp.as_service();

select place_sale(jsonb_build_object(
  'kind', 'order',
  'org_id', (select org from _ps_fixture),
  'idempotency_key', 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  'customer_id', (select customer from _ps_fixture),
  'branch_id', (select branch from _ps_fixture),
  'lines', jsonb_build_array(jsonb_build_object(
    'line_type', 'product', 'product_id', (select product from _ps_fixture), 'qty', 1)),
  'payment', jsonb_build_object('amount', 100, 'method', 'razorpay', 'reference', 'pay_ps_test')
));

select pg_temp.expect_rows($q$
  with s as (
    select id from public.sales
    where org_id = (select org from _ps_fixture)
      and idempotency_key = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'
  )
  select 1
  from s
  where not exists (select 1 from public.sale_lines l where l.sale_id = s.id and l.org_id <> (select org from _ps_fixture))
    and not exists (select 1 from public.payments p where p.sale_id = s.id and p.org_id <> (select org from _ps_fixture))
    and not exists (select 1 from public.stock_movements m where m.note = (select code from public.sales where id = s.id) and m.org_id <> (select org from _ps_fixture))
$q$, 1, 'storefront p.org_id is written to sales, lines, payments and stock rows');

reset role;
rollback;
