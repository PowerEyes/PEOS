-- Subscription engine foundation for PowerOS SaaS (multi-tenant).
-- Adds plan entitlements schema, usage tracking, subscription lifecycle fields,
-- invoices/payments/events, and resolve_entitlements() helper.
-- Additive only; existing orgs backfilled to a grandfathered plan.

-- 1. Extend billing_plans with limits/features metadata
alter table public.billing_plans
  add column if not exists display_order int not null default 0,
  add column if not exists is_public boolean not null default true,
  add column if not exists trial_days int not null default 14,
  add column if not exists grace_days int not null default 7,
  add column if not exists max_branches int,            -- null = unlimited
  add column if not exists max_employees int,
  add column if not exists max_customers int,
  add column if not exists storage_mb int,
  add column if not exists features jsonb not null default '{}'::jsonb;

-- 2. Extend org_subscriptions with lifecycle fields
alter table public.org_subscriptions
  add column if not exists trial_ends_at timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists reactivated_at timestamptz,
  add column if not exists auto_renew boolean not null default true;

-- 3. Subscription usage tracking
create table if not exists public.subscription_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,                 -- branches | employees | customers | storage_mb
  value numeric not null default 0,
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  updated_at timestamptz not null default now(),
  unique (org_id, metric, period_start)
);
alter table public.subscription_usage enable row level security;
create policy subscription_usage_tenant on public.subscription_usage
  for select using (org_id = public.current_org());
revoke all on public.subscription_usage from anon;
grant select on public.subscription_usage to authenticated;

-- 4. Subscription invoices
create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.org_subscriptions(id) on delete set null,
  amount_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  currency text not null default 'INR',
  status text not null default 'issued' check (status in ('issued','paid','overdue','void','credited')),
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  pdf_path text,
  created_at timestamptz not null default now()
);
alter table public.subscription_invoices enable row level security;
create policy subscription_invoices_tenant on public.subscription_invoices
  for select using (org_id = public.current_org());
revoke all on public.subscription_invoices from anon;
grant select on public.subscription_invoices to authenticated;

-- 5. Subscription payments
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.subscription_invoices(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text check (provider is null or provider = 'razorpay'),
  provider_payment_id text unique,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  amount_minor bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.subscription_payments enable row level security;
create policy subscription_payments_tenant on public.subscription_payments
  for select using (org_id = public.current_org());
revoke all on public.subscription_payments from anon;
grant select on public.subscription_payments to authenticated;

-- 6. Subscription events (audit)
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
alter table public.subscription_events enable row level security;
create policy subscription_events_tenant on public.subscription_events
  for select using (org_id = public.current_org());
revoke all on public.subscription_events from anon;
grant select on public.subscription_events to authenticated;

-- 7. resolve_entitlements(org_id) -> jsonb
create or replace function public.resolve_entitlements(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_sub record;
  v_plan record;
  v_status text;
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
begin
  select * into v_sub from public.org_subscriptions
    where org_id = p_org order by created_at desc limit 1;

  if v_sub is null then
    -- No subscription: minimal read-only entitlements
    return jsonb_build_object('status','none','features',jsonb_build_object(),'limits',jsonb_build_object('branches',1,'employees',3,'customers',100,'storage_mb',100));
  end if;

  v_status := v_sub.status;
  -- grace window handling
  if v_status = 'past_due' and v_sub.grace_ends_at is not null and v_sub.grace_ends_at > now() then
    v_status := 'grace';
  end if;

  select * into v_plan from public.billing_plans where id = v_sub.plan_id;

  if v_plan is null then
    return jsonb_build_object('status', v_status, 'features', jsonb_build_object(), 'limits', jsonb_build_object());
  end if;

  v_features := coalesce(v_plan.features, '{}'::jsonb);
  v_limits := jsonb_build_object(
    'branches', v_plan.max_branches,
    'employees', v_plan.max_employees,
    'customers', v_plan.max_customers,
    'storage_mb', v_plan.storage_mb
  );

  -- Expired/suspended/cancelled: restrict writes but keep reads
  if v_status in ('expired','suspended','cancelled') then
    v_features := v_features || jsonb_build_object('_writes_blocked', true);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'trial_ends_at', v_sub.trial_ends_at,
    'grace_ends_at', v_sub.grace_ends_at,
    'current_period_end', v_sub.current_period_end,
    'features', v_features,
    'limits', v_limits
  );
end $$;

grant execute on function public.resolve_entitlements(uuid) to authenticated, service_role;

-- 8. Seed default plans (inactive until platform admin activates; safe to re-run)
insert into public.billing_plans (code, name, active, price_minor, interval, trial_days, grace_days, max_branches, max_employees, max_customers, storage_mb, features, display_order, is_public)
values
  ('starter','Starter', false, 99900, 'month', 14, 7, 1, 5, 1000, 500, '{"pos":true,"prescriptions":true,"lab":"basic","lpims":"basic","finance":"basic","multi_branch_reports":false,"api_integrations":false,"priority_support":false}'::jsonb, 1, true),
  ('growth','Growth', false, 299900, 'month', 14, 7, 5, 25, 10000, 2000, '{"pos":true,"prescriptions":true,"lab":"advanced","lpims":"advanced","finance":"advanced","multi_branch_reports":true,"api_integrations":"limited","priority_support":false}'::jsonb, 2, true),
  ('enterprise','Enterprise', false, null, 'month', 14, 7, null, null, null, null, '{"pos":true,"prescriptions":true,"lab":"advanced","lpims":"advanced","finance":"advanced","multi_branch_reports":true,"api_integrations":"advanced","priority_support":true}'::jsonb, 3, true)
on conflict (code) do nothing;

-- 9. Grandfather existing orgs: create an active subscription on a hidden 'legacy' plan
insert into public.billing_plans (code, name, active, price_minor, interval, trial_days, grace_days, max_branches, max_employees, max_customers, storage_mb, features, display_order, is_public)
values ('legacy','Legacy (Grandfathered)', false, 0, 'month', 0, 30, null, null, null, null, '{"pos":true,"prescriptions":true,"lab":"advanced","lpims":"advanced","finance":"advanced","multi_branch_reports":true,"api_integrations":"advanced","priority_support":true}'::jsonb, 99, false)
on conflict (code) do nothing;

insert into public.org_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
select o.id, (select id from public.billing_plans where code='legacy'), 'active', now(), now() + interval '10 years'
from public.organizations o
where not exists (select 1 from public.org_subscriptions s where s.org_id = o.id);

-- 10. Platform users table (separate auth scope)
create table if not exists public.platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,                  -- auth.users.id when linked
  email text not null unique,
  platform_role text not null default 'support' check (platform_role in ('super_admin','support','billing','read_only')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.platform_users enable row level security;
-- Only service role manages platform users; no tenant access.
revoke all on public.platform_users from anon, authenticated;

-- 11. Platform audit log
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.platform_audit_logs enable row level security;
revoke all on public.platform_audit_logs from anon, authenticated;
grant select, insert on public.platform_audit_logs to service_role;