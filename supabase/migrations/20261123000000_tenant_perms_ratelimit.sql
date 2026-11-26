-- Domain→organisation mapping, configurable role permissions, export audit, rate limiting, branch-aware storage.

-- ── 1. Domains (storefront resolves the tenant from the request host) ───────────
create table if not exists org_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(), created_by uuid default auth.uid());
alter table org_domains enable row level security;
drop policy if exists domains_sel on org_domains;
create policy domains_sel on org_domains for select to authenticated using (org_id = public.current_org() and public.is_admin());
revoke insert, update, delete on org_domains from anon, authenticated;
drop trigger if exists trg_domains_audit on org_domains;
alter table org_domains add column if not exists id uuid not null default gen_random_uuid();
create trigger trg_domains_audit after insert or delete on org_domains for each row execute function audit_row();
create or replace function public.org_for_host(p_host text) returns uuid language sql stable security definer set search_path = public as
$$ select org_id from org_domains where domain = lower(regexp_replace(coalesce(p_host, ''), ':\d+$', '')) limit 1 $$;
revoke execute on function public.org_for_host from anon, authenticated, public;
create or replace function public.add_org_domain(p_domain text) returns void language plpgsql security definer set search_path = public as $$
declare d text := lower(trim(p_domain));
begin
  if not public.is_admin() then raise exception 'Only owners and admins can manage domains' using errcode = '42501'; end if;
  if d !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' then raise exception 'Enter a valid domain, e.g. shop.example.com'; end if;
  begin insert into org_domains (domain, org_id) values (d, public.current_org());
  exception when unique_violation then raise exception 'That domain is already registered'; end;
end $$;
create or replace function public.remove_org_domain(p_domain text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can manage domains' using errcode = '42501'; end if;
  delete from org_domains where domain = lower(trim(p_domain)) and org_id = public.current_org();
end $$;

-- Customer signups land in the organisation named by the storefront (validated), else the first organisation.
create or replace function public.sync_auth_to_customer() returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_br uuid; v_name text; v_phone text; v_meta text := new.raw_user_meta_data->>'org_id';
begin
  if (new.raw_user_meta_data->>'is_staff') = 'true' then
    insert into public.profiles (id, full_name) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1))) on conflict (id) do nothing;
    return new;
  end if;
  if exists (select 1 from public.customers where auth_user_id = new.id) then return new; end if;
  if v_meta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then select id into v_org from public.organizations where id = v_meta::uuid; end if;
  if v_org is null then select id into v_org from public.organizations order by created_at limit 1; end if;
  if v_org is null then return new; end if;
  select id into v_br from public.branches where org_id = v_org and is_active order by name limit 1;
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '');
  insert into public.customers (org_id, branch_id, full_name, phone, email, auth_user_id, notes) values (v_org, v_br, v_name, v_phone, new.email, new.id, 'Auto-created from website portal');
  return new;
end $$;

-- ── 2. Configurable role permissions (replaces hard "managers only") ────────────
create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id) on delete cascade,
  role_key text not null check (role_key in ('branch_manager', 'staff')),
  permission text not null check (permission in ('finance_view', 'expenses', 'day_closing', 'catalogue_edit')),
  allowed boolean not null, updated_by uuid default auth.uid(), updated_at timestamptz not null default now(),
  unique (org_id, role_key, permission));
-- 20261122010000 already created role_permissions as a bare grant table
-- (org_id, role_key, permission) with no `allowed` flag, so the CREATE TABLE
-- above is skipped there. Add the columns has_perm() reads either way; a default
-- is required because that table is already seeded. 20261128000000 repeats this
-- normalisation for databases where this migration ran against the older shape.
alter table role_permissions add column if not exists allowed boolean not null default true;
alter table role_permissions add column if not exists updated_by uuid default auth.uid();
alter table role_permissions add column if not exists updated_at timestamptz not null default now();
-- audit_row() reads coalesce(new.id, old.id), but the 20261122010000 shape has
-- no surrogate key (its PK is org_id+role_key+permission). Same treatment as
-- org_domains gets above; a table that already has `id` is left alone.
alter table role_permissions add column if not exists id uuid not null default gen_random_uuid();
alter table role_permissions enable row level security;
drop policy if exists roleperm_sel on role_permissions;
create policy roleperm_sel on role_permissions for select to authenticated using (org_id = public.current_org());
revoke insert, update, delete on role_permissions from anon, authenticated;
drop trigger if exists trg_roleperm_audit on role_permissions;
create trigger trg_roleperm_audit after insert or update or delete on role_permissions for each row execute function audit_row();
-- Defaults (no row): branch managers allowed, staff denied. Owners/admins always allowed.
create or replace function public.has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(case when r in ('owner', 'admin') then true
    else coalesce((select allowed from role_permissions rp where rp.org_id = public.current_org() and rp.role_key = r and rp.permission = p), r = 'branch_manager') end, false)
  from (select public.current_role_key() r) x $$;
create or replace function public.my_permissions() returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(p), '{}') from unnest(array['finance_view', 'expenses', 'day_closing', 'catalogue_edit']) p where public.has_perm(p) $$;
-- This migration has existed with both p_perm and p_permission in deployments.
-- Drop the exact signature before recreating it so either version upgrades cleanly.
drop function if exists public.set_role_permission(text, text, boolean);
create function public.set_role_permission(p_role text, p_permission text, p_allowed boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can change permissions' using errcode = '42501'; end if;
  insert into role_permissions (org_id, role_key, permission, allowed) values (public.current_org(), p_role, p_permission, p_allowed)
  on conflict (org_id, role_key, permission) do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();
end $$;

do $$
declare
  BR text := 'org_id = public.current_org() and public.can_access_branch(branch_id)';
  r record; p record;
begin
  create temp table _pp (tbl text, rd text, wr text) on commit drop;
  insert into _pp values
    ('cashbook', BR || ' and public.has_perm(''finance_view'')', null),
    ('purchase_invoices', BR || ' and public.has_perm(''finance_view'')', BR || ' and public.has_perm(''finance_view'')'),
    ('gst_periods', 'org_id = public.current_org() and public.has_perm(''finance_view'')', 'org_id = public.current_org() and public.has_perm(''finance_view'')'),
    ('expenses', BR || ' and public.has_perm(''expenses'')', BR || ' and public.has_perm(''expenses'')'),
    ('day_closings', BR || ' and public.has_perm(''day_closing'')', BR || ' and public.has_perm(''day_closing'')'),
    ('suppliers', 'org_id = public.current_org()', 'org_id = public.current_org() and public.has_perm(''catalogue_edit'')'),
    ('products', 'org_id = public.current_org()', 'org_id = public.current_org() and public.has_perm(''catalogue_edit'')'),
    ('brands', 'org_id = public.current_org()', 'org_id = public.current_org() and public.has_perm(''catalogue_edit'')'),
    ('lens_packages', 'org_id = public.current_org()', 'org_id = public.current_org() and public.has_perm(''catalogue_edit'')'),
    ('lens_options', 'org_id = public.current_org()', 'org_id = public.current_org() and public.has_perm(''catalogue_edit'')');
  for r in select * from _pp loop
    continue when to_regclass('public.' || r.tbl) is null;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname like '%\_rls\_%' loop
      execute format('drop policy %I on %I', p.policyname, r.tbl); end loop;
    execute format('create policy %I on %I for select to authenticated using (%s)', r.tbl || '_rls_sel', r.tbl, r.rd);
    if r.wr is not null then
      execute format('create policy %I on %I for insert to authenticated with check (%s)', r.tbl || '_rls_ins', r.tbl, r.wr);
      execute format('create policy %I on %I for update to authenticated using (%s) with check (%s)', r.tbl || '_rls_upd', r.tbl, r.wr, r.wr);
    end if;
  end loop;
end $$;

-- ── 3. Export audit ─────────────────────────────────────────────────────────────
create or replace function public.log_export(p_kind text, p_rows int, p_detail jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_org() is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  insert into audit_log (org_id, user_id, table_name, action, new_data)
  values (public.current_org(), auth.uid(), left(coalesce(p_kind, 'export'), 60), 'EXPORT', jsonb_build_object('rows', p_rows, 'detail', p_detail, 'role', public.current_role_key()));
end $$;
grant execute on function public.log_export to authenticated;
revoke execute on function public.log_export from anon, public;

-- ── 4. Rate limiting (DB-backed, works on serverless; service role only) ────────
create table if not exists rate_limits (key text not null, window_start timestamptz not null, hits int not null default 1, primary key (key, window_start));
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_secs int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_secs) * p_window_secs); h int;
begin
  insert into rate_limits (key, window_start) values (left(p_key, 200), w)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1 returning hits into h;
  if random() < 0.02 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return h <= p_limit;
end $$;
revoke execute on function public.rate_limit_hit from anon, authenticated, public;
grant execute on function public.rate_limit_hit to service_role;
grant execute on function public.org_for_host to service_role;

-- ── 5. Storage: staff read repair photos only for customers whose repairs they can access ──
drop policy if exists repair_files_staff_read on storage.objects;
create policy repair_files_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'repair-images' and (storage.foldername(name))[1] = public.current_org()::text
    and (public.is_admin() or exists (select 1 from repairs r where r.customer_id::text = (storage.foldername(name))[2])));
