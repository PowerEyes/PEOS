-- ============================================================================
-- Modify create_organisation RPC to allow org creation via platform admin
-- This modifies the existing create_organisation function to check platform_admins
-- ============================================================================

create or replace function public.create_organisation(p_name text, p_branch_name text, p_branch_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_br uuid; v_name text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then raise exception 'Confirm your email first' using errcode = '42501'; end if;
  
  -- Allow organisation creation if:
  -- 1. No organisation exists yet (first org bootstrap), OR
  -- 2. The caller is a platform admin
  if exists (select 1 from organizations) and not exists (select 1 from platform_admins where user_id = v_uid) then
    raise exception 'Organisation creation is by invitation only. Contact platform admin.' using errcode='42501';
  end if;
  
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_branch_name, ''))) < 2 or length(trim(coalesce(p_branch_code, ''))) < 1 then raise exception 'Organisation and branch names are required'; end if;
  
  insert into organizations (name) values (trim(p_name)) returning id into v_org;
  insert into branches (org_id, code, name) values (v_org, upper(trim(p_branch_code)), trim(p_branch_name)) returning id into v_br;
  select coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_name from auth.users where id = v_uid;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated)
    values (v_uid, v_org, v_name, 'owner', v_br, true, false)
  on conflict (id) do update set org_id = v_org, role_key = 'owner', branch_id = v_br, is_approved = true, deactivated = false;
  return v_org;
end $$;

-- ── 2. Payment Methods Configuration ─────────────────────────────────────────
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  method text not null check (method in ('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'wallet')),
  is_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, method)
);

alter table payment_methods enable row level security;

create policy payment_methods_member on payment_methods
  for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = payment_methods.org_id
        and om.user_id = auth.uid()
    )
  );

-- Insert default payment methods for Nish Optics
insert into payment_methods (org_id, method, is_enabled)
select id, 'cash', true from organizations where name = 'Nish Optics'
on conflict do nothing;

insert into payment_methods (org_id, method, is_enabled)
select id, 'card', true from organizations where name = 'Nish Optics'
on conflict do nothing;

insert into payment_methods (org_id, method, is_enabled)
select id, 'upi', true from organizations where name = 'Nish Optics'
on conflict do nothing;

insert into payment_methods (org_id, method, is_enabled)
select id, 'bank_transfer', true from organizations where name = 'Nish Optics'
on conflict do nothing;

-- ── 3. Payment Transactions Table ────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sale_id uuid references sales(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'wallet')),
  reference text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table payments enable row level security;

create policy payments_member on payments
  for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = payments.org_id
        and om.user_id = auth.uid()
    )
  );

-- ── 4. Subscription/Entitlement Tables ───────────────────────────────────────
create table if not exists organisation_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id text not null default 'starter',
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table organisation_subscriptions enable row level security;

create policy org_subscriptions_member on organisation_subscriptions
  for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organisation_subscriptions.org_id
        and om.user_id = auth.uid()
    )
  );

-- Insert subscription for Nish Optics
insert into organisation_subscriptions (org_id, plan_id, status)
select id, 'growth', 'active' from organizations where name = 'Nish Optics'
on conflict do nothing;

-- ── 5. Grant Permissions ─────────────────────────────────────────────────────
grant all on platform_users to authenticated;
grant all on platform_invitations to authenticated;
grant all on organizations to authenticated;
alter table organizations enable row level security;
grant all on organization_members to authenticated;
grant all on subscription_plans to authenticated;
grant all on organization_subscriptions to authenticated;
grant all on org_settings to authenticated;
grant all on platform_audit_log to authenticated;
grant all on payment_methods to authenticated;
grant all on payments to authenticated;

-- ============================================================================
-- End of Platform ERP Integration
-- ============================================================================