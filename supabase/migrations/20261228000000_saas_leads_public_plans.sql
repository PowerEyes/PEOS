-- SaaS marketing site ⇄ platform console. Companies are created by the platform team (invitation-only,
-- see create_organisation), so the marketing site collects LEADS that platform admins convert.
create table if not exists public.saas_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  business_name text not null check (length(trim(business_name)) between 2 and 160),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  phone text check (phone is null or length(phone) between 7 and 20),
  branches int check (branches is null or branches between 1 and 1000),
  plan_code text,
  message text check (message is null or length(message) <= 1000),
  status text not null default 'new' check (status in ('new','contacted','converted','rejected')),
  note text,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists saas_leads_open_email on public.saas_leads (lower(email)) where status in ('new','contacted');
alter table public.saas_leads enable row level security;
revoke all on public.saas_leads from anon, authenticated;
grant select, update on public.saas_leads to authenticated;
drop policy if exists saas_leads_platform_read on public.saas_leads;
create policy saas_leads_platform_read on public.saas_leads for select to authenticated using (public.is_platform_admin());
drop policy if exists saas_leads_platform_update on public.saas_leads;
create policy saas_leads_platform_update on public.saas_leads for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Public price list for the marketing site: only active, public plans, only customer-facing columns.
create or replace function public.public_plans() returns table (code text, name text, price_minor bigint, currency text, "interval" text, trial_days int, max_branches int, max_employees int, max_customers int, storage_mb int, features jsonb)
language sql stable security definer set search_path = public as $$
  select code, name, price_minor, currency, "interval", trial_days, max_branches, max_employees, max_customers, storage_mb, features
  from public.billing_plans where active and is_public order by display_order $$;
revoke execute on function public.public_plans() from public;
grant execute on function public.public_plans() to anon, authenticated, service_role;
