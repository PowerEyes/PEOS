-- Align the live database with the platform/schema APIs used by
-- apps/saas-platform and apps/saas-website.
-- Idempotent: safe to re-run against the existing foundation schema.

-- ── organizations: add the columns the SaaS apps expect ──────────────────────
alter table public.organizations add column if not exists subdomain text unique;
alter table public.organizations add column if not exists address_line1 text;
alter table public.organizations add column if not exists address_line2 text;
alter table public.organizations add column if not exists city text;
alter table public.organizations add column if not exists state text;
alter table public.organizations add column if not exists pincode text;
alter table public.organizations add column if not exists country text default 'India';
alter table public.organizations add column if not exists gstin text;
alter table public.organizations add column if not exists pan text;
alter table public.organizations add column if not exists status text not null default 'trial';
alter table public.organizations add column if not exists plan text not null default 'starter';
alter table public.organizations add column if not exists trial_ends_at timestamptz;
alter table public.organizations add column if not exists subscription_id text;
alter table public.organizations add column if not exists updated_at timestamptz default now();
alter table public.organizations add column if not exists onboarding_completed_at timestamptz;
alter table public.organizations add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_status_check'
  ) then
    alter table public.organizations add constraint organizations_status_check
      check (status in ('trial','active','past_due','suspended','cancelled'));
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_plan_check'
  ) then
    alter table public.organizations add constraint organizations_plan_check
      check (plan in ('starter','growth','enterprise'));
  end if;
  -- created_by stores the Supabase Auth user id. It intentionally has no FK
  -- to platform_users: SaaS customers are not platform staff.
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'organizations'
      and constraint_name = 'organizations_created_by_fkey'
  ) then
    alter table public.organizations drop constraint organizations_created_by_fkey;
  end if;
end $$;

-- ── platform_users: keep legacy columns and add the names the code uses ──────
alter table public.platform_users add column if not exists role text;
alter table public.platform_users add column if not exists full_name text;
update public.platform_users set role = coalesce(role, platform_role) where role is null;

-- ── organisation memberships ─────────────────────────────────────────────────
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, user_id)
);
alter table public.organization_members enable row level security;
create index if not exists idx_organization_members_org on public.organization_members(org_id);
create index if not exists idx_organization_members_user on public.organization_members(user_id);

-- ── platform invitations ─────────────────────────────────────────────────────
create table if not exists public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'support',
  token text unique not null,
  invited_by uuid references public.platform_users(user_id),
  invited_by_name text,
  status text not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz default now()
);
alter table public.platform_invitations enable row level security;
create index if not exists idx_platform_invitations_email on public.platform_invitations(email);
create index if not exists idx_platform_invitations_token on public.platform_invitations(token);
create index if not exists idx_platform_invitations_status on public.platform_invitations(status);

-- ── subscription plans and organisation subscriptions ───────────────────────
create table if not exists public.subscription_plans (
  id text primary key,
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
alter table public.subscription_plans enable row level security;

insert into public.subscription_plans
  (id, name, description, price_monthly, price_yearly, max_branches, max_customers, features, sort_order)
values
  ('starter','Starter','Perfect for single-store optical shops',999,9990,1,500,ARRAY['POS billing','Basic inventory','Prescriptions','Basic reports'],1),
  ('growth','Growth','For growing multi-branch stores',2499,24990,3,10000,ARRAY['POS billing','Multi-branch','Lab & Workshop','QC & Delivery','Advanced reports','GST invoicing'],2),
  ('enterprise','Enterprise','For large optical chains',7499,74990,100,100000,ARRAY['Everything in Growth','Unlimited branches','White-label website','API access','Priority support'],3)
on conflict (id) do nothing;

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'trial',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  razorpay_customer_token text,
  checkout_signature text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.organization_subscriptions enable row level security;
create index if not exists idx_org_subs_org on public.organization_subscriptions(org_id);

-- ── email verification tokens ────────────────────────────────────────────────
create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token text unique not null,
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  created_at timestamptz default now()
);
alter table public.email_verifications enable row level security;
create index if not exists idx_email_verifications_token on public.email_verifications(token);

-- ── support tickets ──────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.support_tickets enable row level security;

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_name text,
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);
alter table public.support_ticket_messages enable row level security;
create index if not exists idx_support_ticket_messages_ticket on public.support_ticket_messages(ticket_id);
