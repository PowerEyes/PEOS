-- SaaS enforcement layer for PowerOS: platform admin helpers, subscription
-- entitlement limits at the database, usage reporting and platform RLS.
-- Additive; safe to re-run.

-- 1. Platform admin helpers (separate authorization scope from tenants)
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.platform_users
    where user_id = auth.uid() and is_active
      and platform_role in ('super_admin','support','billing','read_only')
  );
$$;
revoke execute on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function public.platform_role() returns text
language sql stable security definer set search_path=public as $$
  select platform_role from public.platform_users where user_id = auth.uid() and is_active limit 1;
$$;
revoke execute on function public.platform_role() from public, anon, authenticated;
grant execute on function public.platform_role() to authenticated, service_role;

create or replace function public.is_platform_super_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.platform_role(), '') = 'super_admin';
$$;
revoke execute on function public.is_platform_super_admin() from public, anon, authenticated;
grant execute on function public.is_platform_super_admin() to authenticated, service_role;

-- 1b. Enforcement rollout knob (plan 9.5 / 9.6).
--   'log'     -> a limit violation is recorded (Postgres warning + an audit_log
--                row) and the write still goes through, so a mis-counted limit
--                can never lock a customer out of their own business while the
--                enforcement layer is being validated.
--   'enforce' -> violations raise 42501 and the write is refused.
-- A fresh install ships in 'log'; it is flipped from /platform once validated,
-- after which the knob itself is removed (plan 9.6).
create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings
  for select to authenticated using (public.is_platform_admin());
revoke insert, update, delete on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;

insert into public.platform_settings (key, value)
values ('entitlement_enforcement', '"log"')
on conflict (key) do nothing;

create or replace function public.entitlement_enforcement()
returns text
language sql stable security definer set search_path = public as $$
  select case
    when coalesce((select value #>> '{}' from public.platform_settings
                   where key = 'entitlement_enforcement'), 'log') = 'enforce'
      then 'enforce'
    else 'log' end;
$$;
revoke execute on function public.entitlement_enforcement() from public, anon;
grant execute on function public.entitlement_enforcement() to authenticated, service_role;

-- Records a violation that log-only mode lets through. The audit write is
-- deliberately best-effort: log-only must never itself become a way to block.
create or replace function public.entitlement_log_only(
  p_org uuid, p_table text, p_row uuid, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise warning 'ENTITLEMENT LOG-ONLY: % % %', p_table, p_row, p_detail::text;
  begin
    insert into public.audit_log (org_id, table_name, row_id, action, new_data)
    values (p_org, p_table, p_row, 'ENTITLEMENT_LOG_ONLY', p_detail);
  exception when others then
    raise warning 'ENTITLEMENT LOG-ONLY: audit write failed (%), warning stands', SQLERRM;
  end;
end $$;
revoke execute on function public.entitlement_log_only(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- 2. Platform tables become readable (and for super admins, writable) by platform admins
drop policy if exists platform_users_admin on public.platform_users;
create policy platform_users_admin on public.platform_users
  for select using (public.is_platform_super_admin());
drop policy if exists platform_audit_read on public.platform_audit_logs;
create policy platform_audit_read on public.platform_audit_logs
  for select using (public.is_platform_admin());
grant select, insert, update on public.platform_users to authenticated;
grant select, insert on public.platform_audit_logs to authenticated;

-- 3. Live usage counts for an organisation (branches / employees / customers / storage)
create or replace function public.org_usage(p_org uuid)
returns table(metric text, value bigint)
language sql stable security definer set search_path=public as $$
  select 'branches'::text, count(*) from public.branches where org_id = p_org and is_active
  union all
  select 'employees'::text, count(*) from public.profiles where org_id = p_org and is_approved and coalesce(deactivated,false) = false
  union all
  select 'customers'::text, count(*) from public.customers where org_id = p_org
  union all
  select 'storage_mb'::text, 0::bigint;
$$;
revoke execute on function public.org_usage(uuid) from public, anon;
grant execute on function public.org_usage(uuid) to authenticated, service_role;

-- 4. Subscription limits enforced at the database (branches & employee seats).
-- Grandfathered / legacy plans carry null limits (= unlimited), so existing orgs
-- are unaffected. Only active/trialing/grace subscriptions are enforced.
-- Both triggers consult entitlement_enforcement() above: in 'log' mode they
-- record the violation and let the write through instead of raising.
create or replace function public.enforce_branch_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_max int; v_cur int;
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.is_active and not coalesce(old.is_active,false)) then
    select max_branches into v_max from public.billing_plans bp
      join public.org_subscriptions s on s.plan_id = bp.id
      where s.org_id = new.org_id order by s.created_at desc limit 1;
    if v_max is not null then
      select count(*) into v_cur from public.branches where org_id = new.org_id and is_active
        and (tg_op = 'UPDATE' or id is distinct from new.id);
      -- v_cur never contains the row being written (it is not active yet on
      -- INSERT, and is excluded by is_active while still inactive on UPDATE), so
      -- the row under test must be counted explicitly or a max_branches=1 plan
      -- silently admits a second branch.
      if (v_cur + (case when tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.is_active) then 1 else 0 end)) > v_max then
        if coalesce(public.entitlement_enforcement(), 'log') = 'enforce' then
          raise exception 'Branch limit reached for your subscription plan. Upgrade to add more branches.'
            using errcode = '42501';
        end if;
        perform public.entitlement_log_only(new.org_id, tg_table_name, new.id, jsonb_build_object(
          'limit', 'branches', 'max', v_max, 'current', v_cur, 'op', tg_op));
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_enforce_branch_limit on public.branches;
create trigger trg_enforce_branch_limit before insert or update on public.branches
  for each row execute function public.enforce_branch_limit();

create or replace function public.enforce_employee_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_max int; v_cur int;
begin
  if new.org_id is null then return new; end if;
  if new.is_approved and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and not coalesce(old.is_approved,false))) then
    select max_employees into v_max from public.billing_plans bp
      join public.org_subscriptions s on s.plan_id = bp.id
      where s.org_id = new.org_id order by s.created_at desc limit 1;
    if v_max is not null then
      select count(*) into v_cur from public.profiles
        where org_id = new.org_id and is_approved and coalesce(deactivated,false) = false
          and id is distinct from new.id;
      if (v_cur + (case when new.is_approved then 1 else 0 end)) > v_max then
        if coalesce(public.entitlement_enforcement(), 'log') = 'enforce' then
          raise exception 'Employee seat limit reached for your subscription plan. Upgrade to invite more staff.'
            using errcode = '42501';
        end if;
        perform public.entitlement_log_only(new.org_id, tg_table_name, new.id, jsonb_build_object(
          'limit', 'employees', 'max', v_max, 'current', v_cur, 'op', tg_op));
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_enforce_employee_limit on public.profiles;
create trigger trg_enforce_employee_limit before insert or update on public.profiles
  for each row execute function public.enforce_employee_limit();

-- 5. Platform announcements & support tickets (company-visible, platform-managed)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null,
  target text not null default 'all' check (target in ('all','trialing','past_due','expired')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid
);
alter table public.announcements enable row level security;
create policy announcements_read on public.announcements for select using (true);
revoke all on public.announcements from anon;
grant select on public.announcements to authenticated;
grant select, insert, update, delete on public.announcements to service_role;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject text not null, body text,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_by uuid, assigned_to uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
create policy support_tickets_tenant on public.support_tickets
  for select using (org_id = public.current_org());
create policy support_tickets_tenant_insert on public.support_tickets
  for insert with check (org_id = public.current_org());
revoke all on public.support_tickets from anon;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert, update, delete on public.support_tickets to service_role;

-- 6. Tenant-managed subscription writes (owner/admin only, org-scoped)
create or replace function public.is_org_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and org_id = public.current_org()
      and role_key in ('owner','admin') and is_approved and coalesce(deactivated,false) = false
  );
$$;
revoke execute on function public.is_org_admin() from public, anon;
grant execute on function public.is_org_admin() to authenticated, service_role;

drop policy if exists org_subscriptions_tenant_select on public.org_subscriptions;
create policy org_subscriptions_tenant_select on public.org_subscriptions
  for select using (org_id = public.current_org());
drop policy if exists org_subscriptions_tenant_write on public.org_subscriptions;
create policy org_subscriptions_tenant_write on public.org_subscriptions
  for insert with check (org_id = public.current_org() and public.is_org_admin());
drop policy if exists org_subscriptions_tenant_update on public.org_subscriptions;
create policy org_subscriptions_tenant_update on public.org_subscriptions
  for update using (org_id = public.current_org() and public.is_org_admin())
  with check (org_id = public.current_org());
grant select, insert, update on public.org_subscriptions to authenticated;

drop policy if exists subscription_events_tenant_insert on public.subscription_events;
create policy subscription_events_tenant_insert on public.subscription_events
  for insert with check (org_id = public.current_org());
grant insert on public.subscription_events to authenticated;
