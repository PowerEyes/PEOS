-- Reusable non-owner RBAC fixtures for the isolated access/IDOR suites.
--
-- Include from inside an open transaction, as the migration owner/superuser:
--   \ir rbac_role_fixtures.sql
-- This file deliberately has no BEGIN/ROLLBACK; the caller owns the transaction.
-- It is safe to include more than once in the same transaction: temp tables and
-- helper functions are replaced, and seeded rows use deterministic IDs.
--
-- Role model: there is no literal `manager` role. `admin` is the company-manager
-- tier; `branch_manager` is the branch manager. Owner/admin bypass has_perm().
-- cashier keeps the documented `credit_notes.issue` grant even though the
-- owner/admin credit-note trigger wins at write time; the access suite asserts
-- both facts rather than silently resolving the historical conflict.

create temp table if not exists _rbac as
select
  '00000000-0000-0000-0000-000000000001'::uuid as org_a,
  '00000000-0000-0000-0000-000000000002'::uuid as org_b,
  'c1e79328-6a5e-4598-918f-3005f123e23c'::uuid as branch_east,
  'f41906f4-9d95-48aa-80c1-bef031469632'::uuid as branch_west,
  '00000000-0000-0000-0000-0000000000b3'::uuid as branch_b,
  '00000000-0000-0000-0000-000000000011'::uuid as owner_id,
  '00000000-0000-0000-0000-000000000012'::uuid as admin_id,
  '00000000-0000-0000-0000-000000000013'::uuid as branch_manager_id,
  '00000000-0000-0000-0000-000000000014'::uuid as cashier_id,
  '00000000-0000-0000-0000-000000000015'::uuid as optometrist_id,
  '00000000-0000-0000-0000-000000000016'::uuid as staff_id,
  '00000000-0000-0000-0000-000000000021'::uuid as org_b_owner_id,
  '00000000-0000-0000-0000-000000000031'::uuid as customer_id,
  '00000000-0000-0000-0000-000000000032'::uuid as product_id,
  '00000000-0000-0000-0000-000000000033'::uuid as sale_id;
grant select on _rbac to public;

insert into public.organizations (id, name)
select org_a, 'RBAC Org A' from _rbac
union all select org_b, 'RBAC Org B' from _rbac
on conflict (id) do nothing;

insert into public.branches (id, org_id, code, name, is_active)
select branch_east, org_a, 'RBAC-E', 'RBAC East', true from _rbac
union all select branch_west, org_a, 'RBAC-W', 'RBAC West', true from _rbac
union all select branch_b, org_b, 'RBAC-B', 'RBAC Branch B', true from _rbac
on conflict (id) do update set org_id = excluded.org_id, code = excluded.code,
  name = excluded.name, is_active = true;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select id, email, now(), '{"is_staff":"true","full_name":"RBAC fixture"}'::jsonb
from _rbac f
cross join lateral (values
  (f.owner_id, 'rbac-owner@test.dev'),
  (f.admin_id, 'rbac-admin@test.dev'),
  (f.branch_manager_id, 'rbac-branch-manager@test.dev'),
  (f.cashier_id, 'rbac-cashier@test.dev'),
  (f.optometrist_id, 'rbac-optometrist@test.dev'),
  (f.staff_id, 'rbac-staff@test.dev'),
  (f.org_b_owner_id, 'rbac-org2-owner@test.dev')
) as u(id, email)
on conflict (id) do nothing;

insert into public.profiles
  (id, org_id, branch_id, full_name, role_key, is_approved, deactivated, branch_reviewed)
select owner_id, org_a, null, 'RBAC Owner', 'owner', true, false, true from _rbac
union all select admin_id, org_a, null, 'RBAC Admin', 'admin', true, false, true from _rbac
union all select branch_manager_id, org_a, branch_east, 'RBAC Branch Manager', 'branch_manager', true, false, true from _rbac
union all select cashier_id, org_a, branch_east, 'RBAC Cashier', 'cashier', true, false, true from _rbac
union all select optometrist_id, org_a, branch_west, 'RBAC Optometrist', 'optometrist', true, false, true from _rbac
union all select staff_id, org_a, branch_west, 'RBAC Staff', 'staff', true, false, true from _rbac
union all select org_b_owner_id, org_b, branch_b, 'RBAC Org B Owner', 'owner', true, false, true from _rbac
on conflict (id) do update set org_id = excluded.org_id, branch_id = excluded.branch_id,
  full_name = excluded.full_name, role_key = excluded.role_key,
  is_approved = true, deactivated = false, branch_reviewed = true;

-- Seed the default catalogue, then pin the exact grants asserted by the suites.
select public.seed_org_permissions(org_a) from _rbac;
select public.seed_org_permissions(org_b) from _rbac;

delete from public.role_permissions
 where org_id = (select org_a from _rbac)
   and role_key in ('branch_manager', 'cashier', 'optometrist', 'staff');

insert into public.role_permissions (org_id, role_key, permission, allowed)
select (select org_a from _rbac), 'branch_manager', p, true
  from unnest(array[
    'finance_view', 'expenses', 'day_closing', 'catalogue_edit', 'reports_view',
    'crm_manage', 'discount_override', 'stock_adjust', 'purchases_manage',
    'stock_audit', 'transfers_approve', 'web_orders', 'credit_notes.issue'
  ]) p
on conflict (org_id, role_key, permission) do update set allowed = true;

insert into public.role_permissions (org_id, role_key, permission, allowed)
select (select org_a from _rbac), 'cashier', p, true
  from unnest(array['finance_view', 'credit_notes.issue']) p;

-- Explicit negatives make the optometrist's clinical-only boundary visible to
-- has_perm() and to reviewers reading the table directly.
insert into public.role_permissions (org_id, role_key, permission, allowed)
select (select org_a from _rbac), 'optometrist', p, false
  from unnest(array[
    'finance_view', 'expenses', 'catalogue_edit', 'discount_override',
    'stock_adjust', 'credit_notes.issue'
  ]) p;

-- Business rows for IDOR probes.
insert into public.customers (id, org_id, branch_id, full_name, phone)
select customer_id, org_a, branch_east, 'RBAC Customer', '9400000001' from _rbac
on conflict (id) do nothing;

insert into public.products (id, org_id, kind, model, sku, selling_price)
select product_id, org_a, 'frame', 'RBAC Cost Frame', 'RBAC-COST-1', 1000 from _rbac
on conflict (id) do nothing;

insert into public.product_costs (product_id, org_id, cost_price)
select product_id, org_a, 400 from _rbac
on conflict (product_id) do update set cost_price = 400;

insert into public.sales (id, org_id, branch_id, customer_id, grand_total, kind, status)
select sale_id, org_a, branch_east, customer_id, 1000, 'order', 'draft' from _rbac
on conflict (id) do nothing;

create or replace function pg_temp.rbac_uid(p_key text) returns uuid
language sql stable as $$
  select case p_key
    when 'owner' then owner_id
    when 'admin' then admin_id
    when 'branch_manager' then branch_manager_id
    when 'cashier' then cashier_id
    when 'optometrist' then optometrist_id
    when 'staff' then staff_id
    when 'org2_owner' then org_b_owner_id
    else null
  end
  from _rbac
$$;

grant execute on function pg_temp.rbac_uid(text) to public;
