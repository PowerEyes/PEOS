-- Database-driven organisation resolution, org defaults and role permissions (replaces hardcoded org id / city / state / role checks)

-- 1. Site -> organisation mapping (public website resolves its tenant from the request host)
create table if not exists site_domains (
  host text primary key, org_id uuid not null references organizations(id) on delete cascade, is_default boolean not null default false);
create unique index if not exists site_domains_one_default on site_domains (org_id) where is_default;
alter table site_domains enable row level security;
drop policy if exists sd_admin on site_domains;
create policy sd_admin on site_domains for all using (org_id = public.current_org() and public.is_admin()) with check (org_id = public.current_org() and public.is_admin());
-- single-tenant installs keep working: the only organisation becomes the default site
insert into site_domains (host, org_id, is_default)
select 'default', id, true from organizations where (select count(*) from organizations) = 1 on conflict do nothing;

create or replace function public.default_org() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select org_id from site_domains where is_default limit 1),
                  (select id from organizations where (select count(*) from organizations) = 1)) $$;
create or replace function public.resolve_org(p_host text default null) returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select org_id from site_domains where host = regexp_replace(lower(coalesce(p_host,'')), '^www\.|:\d+$', '', 'g') limit 1),
                  public.default_org()) $$;
grant execute on function public.resolve_org(text), public.default_org() to anon, authenticated;

-- 2. Organisation defaults live in org_settings (default_city / default_state / default_pincode / home_state_code)
create or replace function public.org_default_text(p_key text, p_fallback text default '', p_org uuid default null) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from org_settings where org_id = coalesce(p_org, public.current_org(), public.default_org()) and key = p_key), p_fallback) $$;
grant execute on function public.org_default_text(text,text,uuid) to anon, authenticated;
-- backfill from each organisation's own existing customers (no invented values)
insert into org_settings (org_id, key, value)
select org_id, k, to_jsonb(v) from (
  select org_id, 'default_city' k, mode() within group (order by city) v from customers where coalesce(city,'')<>'' group by org_id
  union all select org_id, 'default_state', mode() within group (order by state) from customers where coalesce(state,'')<>'' group by org_id
  union all select org_id, 'default_pincode', mode() within group (order by pincode) from customers where coalesce(pincode,'')<>'' group by org_id) s
where v is not null on conflict do nothing;
-- column defaults that hardcoded 'Tamil Nadu'
do $$ declare r record; begin
  for r in select table_name, column_name from information_schema.columns where table_schema='public' and column_default like '%Tamil Nadu%' loop
    execute format('alter table public.%I alter column %I set default public.org_default_text(''default_state'','''')', r.table_name, r.column_name);
  end loop;
  -- staff-written tables without an org default now fill org_id from the signed-in staff member
  for r in select c.table_name from information_schema.columns c join pg_class k on k.relname=c.table_name and k.relnamespace='public'::regnamespace and k.relkind='r'
           where c.table_schema='public' and c.column_name='org_id' and c.column_default is null loop
    execute format('alter table public.%I alter column org_id set default public.current_org()', r.table_name);
  end loop;
end $$;

-- website customer auto-creation: org from signup metadata (validated) or the default site; place defaults from org settings
create or replace function public.sync_auth_to_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_br uuid; v_name text; v_phone text; v_inv staff_invitations%rowtype;
begin
  if (new.raw_user_meta_data->>'is_staff') = 'true' then
    select * into v_inv from staff_invitations where lower(email) = lower(new.email) and accepted_at is null and revoked_at is null and expires_at > now() limit 1;
    insert into profiles (id, full_name, org_id) values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)), v_inv.org_id) on conflict (id) do nothing;
    if v_inv.id is not null then update staff_invitations set accepted_user_id = new.id, accepted_at = now() where id = v_inv.id; end if;
    return new;
  end if;
  if exists (select 1 from customers where auth_user_id = new.id) then return new; end if;
  select id into v_org from organizations where id::text = new.raw_user_meta_data->>'org_id';
  v_org := coalesce(v_org, public.default_org());
  if v_org is null then return new; end if;   -- ambiguous tenant: the site links the customer after login via resolve_org()
  select id into v_br from branches where org_id = v_org and is_active order by name limit 1;
  v_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''), '');
  insert into customers (org_id, branch_id, full_name, phone, email, auth_user_id, city, state, pincode, notes)
  values (v_org, v_br, v_name, v_phone, new.email, new.id,
    public.org_default_text('default_city','',v_org), public.org_default_text('default_state','',v_org), public.org_default_text('default_pincode','',v_org), 'Auto-created from website portal');
  return new;
end $$;

-- 3. Role permissions (data, per organisation). Owner/admin are always full-access; other roles come from this table.
create table if not exists permission_catalog (key text primary key, description text not null, default_roles text[] not null default '{}');
insert into permission_catalog (key, description, default_roles) values
 ('finance.view',    'View cashbook, day closing and GST periods',        '{branch_manager}'),
 ('finance.manage',  'Close days and manage GST periods',                 '{}'),
 ('expenses.manage', 'Create and edit expenses',                          '{branch_manager}'),
 ('purchases.manage','View and manage suppliers and purchase invoices',   '{branch_manager}'),
 ('credit_notes.issue','Issue credit notes / refunds',                    '{branch_manager}')
on conflict (key) do nothing;
create table if not exists role_permissions (
  org_id uuid not null references organizations(id) on delete cascade, role_key text not null check (role_key in ('branch_manager','staff')),
  permission text not null references permission_catalog(key), primary key (org_id, role_key, permission));
alter table permission_catalog enable row level security; alter table role_permissions enable row level security;
drop policy if exists pc_read on permission_catalog; create policy pc_read on permission_catalog for select using (public.current_org() is not null);
drop policy if exists rp_read on role_permissions; create policy rp_read on role_permissions for select using (org_id = public.current_org());
revoke insert, update, delete on permission_catalog, role_permissions from anon, authenticated;
create or replace function public.seed_org_permissions(p_org uuid) returns void language sql security definer set search_path = public as $$
  insert into role_permissions (org_id, role_key, permission)
  select p_org, r, c.key from permission_catalog c, unnest(c.default_roles) r where r in ('branch_manager','staff') on conflict do nothing $$;
create or replace function public.trg_org_seed_permissions() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_org_permissions(new.id); return new; end $$;
drop trigger if exists trg_org_perm_seed on organizations;
create trigger trg_org_perm_seed after insert on organizations for each row execute function public.trg_org_seed_permissions();
select public.seed_org_permissions(id) from organizations;

create or replace function public.has_permission(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_approved and not pr.deactivated
    and (pr.role_key in ('owner','admin') or exists (select 1 from role_permissions rp where rp.org_id = pr.org_id and rp.role_key = pr.role_key and rp.permission = p))) $$;

create or replace function public.set_role_permission(p_role text, p_permission text, p_allowed boolean) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org();
begin
  if public.current_role_key() <> 'owner' then raise exception 'Only an owner can change role permissions' using errcode='42501'; end if;
  if p_role not in ('branch_manager','staff') then raise exception 'Unknown role'; end if;
  if p_allowed then insert into role_permissions (org_id, role_key, permission) values (v_org, p_role, p_permission) on conflict do nothing;
  else delete from role_permissions where org_id = v_org and role_key = p_role and permission = p_permission; end if;
  insert into audit_log (org_id, table_name, action, new_data) values (v_org, 'role_permissions', case when p_allowed then 'GRANT' else 'REVOKE' end, jsonb_build_object('role', p_role, 'permission', p_permission));
end $$;

-- 4. Enforcement: writes via trigger (also stops SECURITY DEFINER paths), reads via restrictive RLS
create or replace function public.enforce_permission() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and public.current_org() is not null and not public.has_permission(tg_argv[0]) then
    raise exception 'Access denied: requires permission %', tg_argv[0] using errcode='42501'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create or replace function public.apply_permission(t text, p_write text, p_read text) returns void language plpgsql as $$
begin
  if to_regclass('public.'||t) is null then return; end if;
  execute format('drop trigger if exists trg_01_perm on public.%I', t);
  execute format('create trigger trg_01_perm before insert or update or delete on public.%I for each row execute function public.enforce_permission(%L)', t, p_write);
  if p_read is not null then
    execute format('drop policy if exists perm_read on public.%I', t);
    execute format('create policy perm_read on public.%I as restrictive for select using (public.current_org() is null or public.has_permission(%L))', t, p_read);
  end if;
end $$;
select public.apply_permission('expenses','expenses.manage','expenses.manage');
select public.apply_permission('day_closings','finance.manage','finance.view');
select public.apply_permission('gst_periods','finance.manage','finance.view');
select public.apply_permission('suppliers','purchases.manage','purchases.manage');
select public.apply_permission('purchase_invoices','purchases.manage','purchases.manage');
select public.apply_permission('purchase_items','purchases.manage','purchases.manage');
select public.apply_permission('credit_notes','credit_notes.issue',null);
select public.apply_permission('credit_note_lines','credit_notes.issue',null);
-- cashbook is written by the payment trigger on every sale (must stay writable); only reading is restricted
do $$ begin if to_regclass('public.cashbook') is not null then
  drop policy if exists perm_read on cashbook;
  create policy perm_read on cashbook as restrictive for select using (public.current_org() is null or public.has_permission('finance.view')); end if; end $$;

-- 5. Tenant-aware public (anon) reads. The website sends its host in the x-site-host header (PostgREST exposes it);
--    signed-in staff always resolve to their own organisation.
create or replace function public.request_org() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(public.current_org(),
    public.resolve_org(nullif(current_setting('request.headers', true), '')::json ->> 'x-site-host')) $$;
grant execute on function public.request_org() to anon, authenticated;

do $$ declare r record; begin
  for r in select p.schemaname, p.tablename, p.policyname, p.roles, p.qual from pg_policies p
    where p.schemaname = 'public' and p.cmd = 'SELECT' and ('anon' = any(p.roles) or 'public' = any(p.roles))
      and p.policyname not like '%\_tenant' and exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p.tablename and c.column_name='org_id')
      and coalesce(p.qual,'') not like '%request_org%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I for select to %s using ((%s) and org_id = public.request_org())',
      r.policyname, r.tablename, array_to_string(r.roles, ','), coalesce(r.qual,'true'));
  end loop;
end $$;

create or replace view public.public_site_settings as
  select key, value from public.org_settings
  where org_id = public.request_org() and key in ('whatsapp_number', 'instagram', 'analytics_id');
grant select on public.public_site_settings to anon, authenticated;

create or replace view public_catalog as
select p.id, p.org_id, p.kind, p.sku, b.name as brand, p.model, p.collection, p.gender, p.selling_price, p.mrp,
  p.power_eligible, p.featured, p.new_arrival, p.bestseller, p.short_desc, p.description, p.images, p.attrs,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0) > 0 as in_stock,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0)::int as stock_qty,
  coalesce(v.today_views, 0)::int as today_views
from products p
  left join brands b on b.id = p.brand_id
  left join product_view_counts v on v.product_id = p.id
where p.visible_on_website and p.status = 'active' and p.org_id = public.request_org();
grant select on public_catalog to anon, authenticated;
