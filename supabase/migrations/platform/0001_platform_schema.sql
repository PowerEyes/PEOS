-- ============================================================================
-- PowerOS SaaS Platform Schema
-- Multi-tenancy control plane for managing organisations, billing, and platform users
-- ============================================================================

-- ── 1. Platform Users (Super Admins) ─────────────────────────────────────────
create table platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null check (role in ('super_admin', 'support', 'billing', 'read_only')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table platform_users enable row level security;

create policy platform_users_self on platform_users
  for all to authenticated
  using (user_id = auth.uid());

-- Platform admins can read all
create policy platform_users_admin on platform_users
  for all to authenticated
  using (
    exists (
      select 1 from platform_users pu
      where pu.user_id = auth.uid()
        and pu.role = 'super_admin'
        and pu.is_active = true
    )
  );

-- ── 2. Platform Invitations (Email-based approval flow) ──────────────────────
create table platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'support' check (role in ('super_admin', 'support', 'billing', 'read_only')),
  token text unique not null,
  invited_by uuid references platform_users(user_id),
  invited_by_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table platform_invitations enable row level security;

create policy platform_invitations_admin on platform_invitations
  for all to authenticated
  using (
    exists (
      select 1 from platform_users pu
      where pu.user_id = auth.uid()
        and pu.role in ('super_admin', 'support', 'billing')
        and pu.is_active = true
    )
  );

create index idx_platform_invitations_email on platform_invitations(email);
create index idx_platform_invitations_token on platform_invitations(token);
create index idx_platform_invitations_status on platform_invitations(status);

-- ── 3. Organisations (Multi-tenant SaaS tenants) ─────────────────────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  subdomain text unique,
  business_email text,
  business_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text default 'India',
  currency text default 'INR',
  timezone text default 'Asia/Kolkata',
  financial_year_start_month int default 4 check (financial_year_start_month between 1 and 12),
  gstin text,
  pan text,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  trial_ends_at timestamptz,
  subscription_id text, -- Razorpay/Stripe subscription ID
  created_by uuid references platform_users(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table organizations enable row level security;

create policy organizations_member on organizations
  for select to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organizations.id
        and om.user_id = auth.uid()
    )
  );

create index idx_organizations_status on organizations(status);
create index idx_organizations_plan on organizations(plan);
create index idx_organizations_subdomain on organizations(subdomain);

-- ── 4. Organisation Members (Links platform users to orgs) ───────────────────
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'branch_manager', 'staff', 'optometrist', 'sales_executive', 'cashier', 'inventory_manager', 'lab_technician', 'accountant', 'receptionist')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, user_id)
);

alter table organization_members enable row level security;

create policy organization_members_self on organization_members
  for all to authenticated
  using (user_id = auth.uid());

create index idx_organization_members_org on organization_members(org_id);
create index idx_organization_members_user on organization_members(user_id);

-- ── 5. Subscription Plans ────────────────────────────────────────────────────
create table subscription_plans (
  id text primary key, -- 'starter', 'growth', 'enterprise'
  name text not null,
  description text,
  price_monthly numeric not null,
  price_yearly numeric not null,
  currency text default 'INR',
  max_branches int not null default 1,
  max_customers int not null,
  features text[] default '{}',
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

insert into subscription_plans (id, name, description, price_monthly, price_yearly, max_branches, max_customers, features, sort_order) values
('starter', 'Starter', 'Perfect for single-store optical shops', 999, 9990, 1, 500, ARRAY['POS billing', 'Basic inventory', 'Prescriptions', 'Basic reports'], 1),
('growth', 'Growth', 'For growing multi-branch stores', 2499, 24990, 3, 10000, ARRAY['POS billing', 'Multi-branch', 'Lab & Workshop', 'QC & Delivery', 'Advanced reports', 'GST invoicing'], 2),
('enterprise', 'Enterprise', 'For large optical chains', 7499, 74990, 100, 100000, ARRAY['Everything in Growth', 'Unlimited branches', 'White-label website', 'API access', 'Priority support', 'Custom integrations'], 3);

-- ── 6. Organisation Subscriptions ────────────────────────────────────────────
create table organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id text not null references subscription_plans(id),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  razorpay_customer_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table organization_subscriptions enable row level security;

create policy org_subscriptions_member on organization_subscriptions
  for select to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_subscriptions.org_id
        and om.user_id = auth.uid()
    )
  );

-- ── 7. Organisation Settings (SaaS configuration) ────────────────────────────
create table org_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz default now(),
  unique (org_id, key)
);

alter table org_settings enable row level security;

create policy org_settings_member on org_settings
  for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = org_settings.org_id
        and om.user_id = auth.uid()
    )
  );

-- ── 8. Platform Audit Log ────────────────────────────────────────────────────
create table platform_audit_log (
  id bigserial primary key,
  user_id uuid references platform_users(user_id),
  action text not null,
  target_type text not null check (target_type in ('organisation', 'user', 'subscription', 'invitation', 'settings')),
  target_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

alter table platform_audit_log enable row level security;

create policy platform_audit_admin on platform_audit_log
  for select to authenticated
  using (
    exists (
      select 1 from platform_users pu
      where pu.user_id = auth.uid()
        and pu.role in ('super_admin', 'support', 'billing')
        and pu.is_active = true
    )
  );

create index idx_platform_audit_created_at on platform_audit_log(created_at);
create index idx_platform_audit_user on platform_audit_log(user_id);

-- ── 9. Enable RLS on existing ERP tables for platform access ─────────────────
-- These ensure platform admins can read across all orgs (for support/billing)
-- but cannot write without proper org membership

-- Grant platform users access to read org-scoped data (read-only for support)
-- This is handled at the application level via service_role for platform ops

-- ── 10. Functions & Triggers ─────────────────────────────────────────────────

-- Auto-create org_settings default rows when a new org is created
create or replace function public.org_settings_defaults()
returns trigger language plpgsql as $$
begin
  insert into org_settings (org_id, key, value)
  values
    (new.id, 'setup_wizard_step', '0'),
    (new.id, 'gst_enabled', 'true'),
    (new.id, 'default_supply_type', 'intrastate'),
    (new.id, 'default_state_of_supply', coalesce(new.state, 'Tamil Nadu')),
    (new.id, 'code_prefixes', '{"cus": "CUS-", "ord": "ORD-", "rx": "RX-", "rep": "REP-", "lab": "LAB-", "cn": "CN-"}'),
    (new.id, 'whatsapp_number', null),
    (new.id, 'instagram', null)
  on conflict (org_id, key) do nothing;
  return new;
end $$;

create trigger trg_org_settings_defaults
after insert on organizations
for each row execute function public.org_settings_defaults();

-- Auto-create default branches when org is created
create or replace function public.org_default_branch()
returns trigger language plpgsql as $$
declare
  v_branch_id uuid;
begin
  -- Only create default branch if not already exists
  if not exists (select 1 from branches where org_id = new.id limit 1) then
    insert into branches (org_id, code, name, address, phone, gstin, is_active, is_default_pickup)
    values (
      new.id,
      upper(trim(new.code)) or upper(substring(new.name from 1 for 3)),
      trim(new.name) || ' Main',
      new.address,
      new.business_phone,
      new.gstin,
      true,
      true
    ) returning id into v_branch_id;

    -- Set as default pickup branch
    if v_branch_id is not null then
      perform set_default_pickup_branch(v_branch_id);
    end if;
  end if;
  return new;
end $$;

create trigger trg_org_default_branch
after insert on organizations
for each row execute function public.org_default_branch();

-- ── 11. Revoke direct table access from public ───────────────────────────────
revoke all on platform_users from anon, authenticated;
revoke all on platform_invitations from anon, authenticated;
revoke all on organizations from anon, authenticated;
revoke all on organization_members from anon, authenticated;
revoke all on subscription_plans from anon, authenticated;
revoke all on organization_subscriptions from anon, authenticated;
revoke all on org_settings from anon, authenticated;
revoke all on platform_audit_log from anon, authenticated;

-- Grant execute on helper functions
grant execute on function public.org_settings_defaults() to authenticated;
grant execute on function public.org_default_branch() to authenticated;

-- ============================================================================
-- End of Platform Schema
-- ============================================================================