-- Data-backed workflow foundations: priced checkout quotes, stock audits,
-- configurable operational permissions, and subscription entitlement records.

-- Quote snapshots created by the server before contacting Razorpay. Never expose
-- this table through anon/authenticated Data API roles.
create table if not exists public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quote jsonb not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id text unique,
  status text not null default 'created' check (status in ('created','paid','consumed','expired','failed')),
  expires_at timestamptz not null default now() + interval '20 minutes',
  consumed_at timestamptz,
  sale_id uuid references public.sales(id),
  created_at timestamptz not null default now()
);
alter table public.checkout_quotes enable row level security;
revoke all on public.checkout_quotes from anon, authenticated;
grant select, insert, update, delete on public.checkout_quotes to service_role;
create index if not exists checkout_quotes_expiry on public.checkout_quotes(status, expires_at);
create unique index if not exists sales_idempotency_org_key on public.sales(org_id, idempotency_key) where idempotency_key is not null;

-- Physical cycle count with an immutable expected-stock snapshot and atomic approval.
create table if not exists public.stock_audit_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  title text not null check (length(trim(title)) between 2 and 120),
  brand_id uuid references public.brands(id),
  shelf_location text,
  status text not null default 'counting' check (status in ('counting','submitted','approved','cancelled')),
  started_by uuid not null default auth.uid() references public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> started_by)
);
create table if not exists public.stock_audit_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  session_id uuid not null references public.stock_audit_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  expected_qty integer not null check (expected_qty >= 0),
  counted_qty integer check (counted_qty is null or counted_qty >= 0),
  counted_by uuid references public.profiles(id),
  counted_at timestamptz,
  unique(session_id, product_id)
);
create unique index if not exists branches_id_org_unique on public.branches(id, org_id);
-- Every transition, branch and expected quantity is enforced by the database.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.stock_audit_sessions'::regclass and conname='stock_audit_branch_org_fk') then
    alter table public.stock_audit_sessions add constraint stock_audit_branch_org_fk foreign key (branch_id, org_id) references public.branches(id, org_id) not valid;
  end if;
end $$;
alter table public.stock_audit_sessions validate constraint stock_audit_branch_org_fk;
create or replace function public.guard_stock_audit_line() returns trigger
language plpgsql set search_path = public as $$
declare s public.stock_audit_sessions%rowtype;
begin
  select * into s from public.stock_audit_sessions where id = coalesce(new.session_id, old.session_id) for update;
  if not found or s.status <> 'counting' or s.org_id <> public.current_org() or not public.can_access_branch(s.branch_id) then
    raise exception 'Stock count is locked or not accessible' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.products p where p.id = new.product_id and p.org_id = s.org_id and p.status = 'active') then
      raise exception 'Product is not active in this organisation';
    end if;
    select qty into new.expected_qty from public.stock where org_id=s.org_id and branch_id=s.branch_id and product_id=new.product_id;
    new.expected_qty := coalesce(new.expected_qty,0);
    new.org_id := s.org_id;
  elsif tg_op = 'UPDATE' then
    if new.session_id <> old.session_id or new.product_id <> old.product_id or new.expected_qty <> old.expected_qty then
      raise exception 'Count line identity and expected quantity are immutable';
    end if;
    new.org_id := old.org_id;
    new.counted_by := auth.uid(); new.counted_at := now();
  end if;
  return coalesce(new, old);
end $$;

-- Session lifecycle and branch identity are enforced in the database so direct
-- table writes cannot bypass the submit/approve workflow or move a count.
create or replace function public.guard_stock_audit_session() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.org_id <> public.current_org() or new.started_by <> auth.uid()
       or new.status <> 'counting' or new.submitted_at is not null
       or new.approved_by is not null or new.approved_at is not null
       or not public.has_perm('stock_audit') or not public.can_access_branch(new.branch_id) then
      raise exception 'Invalid or unauthorised stock audit session' using errcode='42501';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.org_id is distinct from old.org_id
       or new.branch_id is distinct from old.branch_id or new.title is distinct from old.title
       or new.brand_id is distinct from old.brand_id or new.shelf_location is distinct from old.shelf_location
       or new.started_by is distinct from old.started_by or new.created_at is distinct from old.created_at then
      raise exception 'Stock audit identity and scope are immutable';
    end if;
    if old.status = 'counting' and new.status = 'submitted' then
      if auth.uid() <> old.started_by or not public.has_perm('stock_audit')
         or exists (select 1 from public.stock_audit_lines where session_id=old.id and counted_qty is null) then
        raise exception 'Every line must be counted by the session owner before submission' using errcode='42501';
      end if;
      new.submitted_at := now(); new.approved_by := null; new.approved_at := null;
    elsif old.status = 'submitted' and new.status = 'approved' then
      if auth.uid() is null or auth.uid() = old.started_by or not public.is_manager()
         or not public.has_perm('stock_audit') or new.approved_by is distinct from auth.uid() then
        raise exception 'Only another authorised manager can approve this stock count' using errcode='42501';
      end if;
      new.approved_at := now();
    else
      raise exception 'Invalid stock audit state transition';
    end if;
    return new;
  end if;
  raise exception 'Stock audit sessions cannot be deleted';
end $$;

do $$
declare definition text; needle text := $n$if v_idem is not null and v_idem <> '' then$n$;
begin
  select pg_get_functiondef('public.place_sale(jsonb)'::regprocedure) into definition;
  if position('pg_advisory_xact_lock(hashtextextended(v_org::text || v_idem, 0))' in definition) = 0 then
    if position(needle in definition) = 0 then raise exception 'Could not locate place_sale idempotency guard'; end if;
    definition := replace(definition, needle, needle || E'\n    perform pg_advisory_xact_lock(hashtextextended(v_org::text || v_idem, 0));');
    execute definition;
  end if;
end $$;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.place_sale(jsonb)'::regprocedure) into definition;
  definition := replace(definition, 'where org_id = public.current_org() and key = ''gst_enabled''', 'where org_id = v_org and key = ''gst_enabled''');
  definition := replace(definition, 'where org_id = public.current_org() and key = ''lab_lead_days''', 'where org_id = v_org and key = ''lab_lead_days''');
  if position('where org_id = v_org and key = ''gst_enabled''' in definition) = 0 or position('where org_id = v_org and key = ''lab_lead_days''' in definition) = 0 then
    raise exception 'Could not bind storefront sale settings to the quote organisation';
  end if;
  execute definition;
end $$;
drop trigger if exists trg_stock_audit_line_guard on public.stock_audit_lines;
create trigger trg_stock_audit_line_guard before insert or update or delete on public.stock_audit_lines for each row execute function public.guard_stock_audit_line();
alter table public.stock_audit_sessions enable row level security;
alter table public.stock_audit_lines enable row level security;
drop policy if exists stock_audit_session_read on public.stock_audit_sessions;
create policy stock_audit_session_read on public.stock_audit_sessions for select to authenticated
  using (org_id = public.current_org() and public.can_access_branch(branch_id));
drop policy if exists stock_audit_session_insert on public.stock_audit_sessions;
create policy stock_audit_session_insert on public.stock_audit_sessions for insert to authenticated
  with check (org_id = public.current_org() and public.can_access_branch(branch_id) and started_by = auth.uid() and public.has_perm('stock_audit'));
drop policy if exists stock_audit_session_update on public.stock_audit_sessions;
create policy stock_audit_session_update on public.stock_audit_sessions for update to authenticated
  using (org_id = public.current_org() and started_by = auth.uid() and status = 'counting' and public.can_access_branch(branch_id) and public.has_perm('stock_audit'))
  with check (org_id = public.current_org() and started_by = auth.uid() and status in ('counting','submitted') and public.can_access_branch(branch_id) and public.has_perm('stock_audit'));
drop policy if exists stock_audit_line_read on public.stock_audit_lines;
create policy stock_audit_line_read on public.stock_audit_lines for select to authenticated
  using (org_id = public.current_org() and exists (select 1 from public.stock_audit_sessions s where s.id = session_id and public.can_access_branch(s.branch_id)));
drop policy if exists stock_audit_line_write on public.stock_audit_lines;
create policy stock_audit_line_write on public.stock_audit_lines for all to authenticated
  using (org_id = public.current_org() and public.has_perm('stock_audit') and exists (select 1 from public.stock_audit_sessions s where s.id = session_id and s.started_by = auth.uid() and s.status = 'counting' and public.can_access_branch(s.branch_id)))
  with check (org_id = public.current_org() and public.has_perm('stock_audit') and exists (select 1 from public.stock_audit_sessions s where s.id = session_id and s.started_by = auth.uid() and s.status = 'counting' and public.can_access_branch(s.branch_id)));
grant select, insert, update on public.stock_audit_sessions to authenticated;
grant select, insert, update on public.stock_audit_lines to authenticated;
drop trigger if exists trg_stock_audit_session_guard on public.stock_audit_sessions;
create trigger trg_stock_audit_session_guard before insert or update or delete on public.stock_audit_sessions for each row execute function public.guard_stock_audit_session();
drop trigger if exists trg_stock_audit_session_audit on public.stock_audit_sessions;
create trigger trg_stock_audit_session_audit after insert or update or delete on public.stock_audit_sessions for each row execute function public.audit_row();
drop trigger if exists trg_stock_audit_line_audit on public.stock_audit_lines;
create trigger trg_stock_audit_line_audit after insert or update or delete on public.stock_audit_lines for each row execute function public.audit_row();

create or replace function public.start_stock_audit(p_branch uuid, p_title text, p_products uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_org uuid := public.current_org();
begin
  if auth.uid() is null or v_org is null or not public.has_perm('stock_audit') or not public.can_access_branch(p_branch) then
    raise exception 'Not authorised to start a stock count' using errcode='42501';
  end if;
  if length(trim(p_title)) not between 2 and 120 or coalesce(array_length(p_products,1),0) not between 1 and 2000 then raise exception 'Enter a title and at least one product'; end if;
  if exists (select 1 from unnest(p_products) x group by x having count(*) > 1) then raise exception 'Duplicate products in stock count'; end if;
  if exists (select 1 from unnest(p_products) x left join products p on p.id=x and p.org_id=v_org and p.status='active' where p.id is null) then raise exception 'One or more products are unavailable'; end if;
  insert into stock_audit_sessions(org_id,branch_id,title,started_by) values(v_org,p_branch,trim(p_title),auth.uid()) returning id into v_session;
  insert into stock_audit_lines(org_id,session_id,product_id,expected_qty)
    select v_org,v_session,p.id,coalesce(k.qty,0) from products p left join stock k on k.product_id=p.id and k.branch_id=p_branch
    where p.id=any(p_products) and p.org_id=v_org;
  return v_session;
end $$;
revoke all on function public.start_stock_audit(uuid,text,uuid[]) from public, anon;
grant execute on function public.start_stock_audit(uuid,text,uuid[]) to authenticated;

-- Add a dedicated stock movement reason while preserving any existing check name.
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.stock_movements'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%reason%' loop
    execute format('alter table public.stock_movements drop constraint %I', c.conname);
  end loop;
  alter table public.stock_movements add constraint stock_movements_reason_check
    check (reason in ('opening','purchase','sale','return','adjustment','damage','transfer_in','transfer_out','audit'));
end $$;

create or replace function public.approve_stock_audit(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.stock_audit_sessions%rowtype; l record; v_delta integer; v_current integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into s from public.stock_audit_sessions where id = p_session for update;
  if not found or s.org_id <> public.current_org() or not public.can_access_branch(s.branch_id) then raise exception 'Stock audit not found' using errcode = '42501'; end if;
  if not (public.is_manager() and public.has_perm('stock_audit')) then raise exception 'Only an authorised manager can approve a stock audit' using errcode = '42501'; end if;
  if s.started_by = auth.uid() then raise exception 'The person who started a count cannot approve it' using errcode = '42501'; end if;
  if s.status <> 'submitted' then raise exception 'Only submitted stock counts can be approved'; end if;
  if exists (select 1 from public.stock_audit_lines where session_id = p_session and counted_qty is null) then raise exception 'Every line must have a counted quantity'; end if;
  for l in select * from public.stock_audit_lines where session_id = p_session loop
    insert into public.stock(org_id,branch_id,product_id,qty) values(s.org_id,s.branch_id,l.product_id,0) on conflict(branch_id,product_id) do nothing;
    select qty into v_current from public.stock where org_id=s.org_id and branch_id=s.branch_id and product_id=l.product_id for update;
    v_delta := l.counted_qty - v_current;
    if v_delta = 0 then continue; end if;
    insert into public.stock_movements(org_id, branch_id, product_id, delta, reason, note, created_by)
    values (s.org_id, s.branch_id, l.product_id, v_delta, 'audit', 'Cycle count ' || left(s.id::text, 8) || '; snapshot variance ' || (l.counted_qty-l.expected_qty), auth.uid());
  end loop;
  update public.stock_audit_sessions set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_session;
  insert into public.audit_log(org_id, user_id, table_name, row_id, action, new_data)
  values (s.org_id, auth.uid(), 'stock_audit_sessions', p_session, 'APPROVE', jsonb_build_object('branch_id',s.branch_id,'line_count',(select count(*) from public.stock_audit_lines where session_id=p_session)));
end $$;
revoke all on function public.approve_stock_audit(uuid) from public, anon;
grant execute on function public.approve_stock_audit(uuid) to authenticated;

-- One transaction for an examination and its optional generated prescription.
create or replace function public.save_eye_examination(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid:=public.current_org(); v_user uuid:=auth.uid(); v_customer uuid; v_appt uuid; v_branch uuid; v_rx uuid; v_exam uuid; v_row public.eye_examinations%rowtype; v_valid date;
begin
  if v_org is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  v_customer := (p_data->>'customer_id')::uuid;
  v_appt := nullif(p_data->>'appointment_id','')::uuid;
  if not exists(select 1 from customers where id=v_customer and org_id=v_org) then raise exception 'Customer not found' using errcode='42501'; end if;
  if v_appt is not null then
    select branch_id into v_branch from appointments where id=v_appt and org_id=v_org and customer_id=v_customer;
    if not found then raise exception 'Appointment not found for this customer'; end if;
  else
    v_branch := nullif(p_data->>'branch_id','')::uuid;
  end if;
  if v_branch is null or not public.can_access_branch(v_branch) then raise exception 'No access to examination branch' using errcode='42501'; end if;
  if nullif(p_data->>'od_sph','') is not null or nullif(p_data->>'os_sph','') is not null then
    v_valid := current_date + make_interval(months => greatest(1,least(60,coalesce(nullif(p_data->>'next_review_months','')::int,24))));
    insert into prescriptions(org_id,branch_id,customer_id,rx_type,od_sph,od_cyl,od_axis,od_add,os_sph,os_cyl,os_axis,os_add,pd_far,pd_near,rx_date,valid_till,examined_by,remarks)
    values(v_org,v_branch,v_customer,coalesce(nullif(p_data->>'rx_type',''),'single_vision'),nullif(p_data->>'od_sph','')::numeric,nullif(p_data->>'od_cyl','')::numeric,nullif(p_data->>'od_axis','')::int,nullif(p_data->>'od_add','')::numeric,nullif(p_data->>'os_sph','')::numeric,nullif(p_data->>'os_cyl','')::numeric,nullif(p_data->>'os_axis','')::int,nullif(p_data->>'os_add','')::numeric,nullif(p_data->>'pd_far','')::numeric,nullif(p_data->>'pd_near','')::numeric,now(),v_valid,coalesce(nullif(p_data->>'examiner_name',''),'Staff'),p_data->>'notes') returning id into v_rx;
  end if;
  select jsonb_populate_record(null::public.eye_examinations, p_data || jsonb_build_object('id',gen_random_uuid(),'org_id',v_org,'branch_id',v_branch,'prescription_id',v_rx,'created_at',now(),'updated_at',now())) into v_row;
  insert into public.eye_examinations select v_row.* returning id into v_exam;
  if v_appt is not null then update appointments set status='completed',updated_at=now() where id=v_appt and org_id=v_org; end if;
  return v_exam;
end $$;
revoke all on function public.save_eye_examination(jsonb) from public, anon;
grant execute on function public.save_eye_examination(jsonb) to authenticated;
drop trigger if exists trg_eye_examination_audit on public.eye_examinations;
create trigger trg_eye_examination_audit after insert or update or delete on public.eye_examinations for each row execute function public.audit_row();

-- Expand the configurable role permissions already used by Staff.
-- Older installs may still have the original dotted permission catalogue and
-- a role_permissions table without its later `allowed` field. Normalize both
-- layouts before installing the current permission keys.
create table if not exists public.permission_catalog (
  key text primary key, description text not null, default_roles text[] not null default '{}'
);
insert into public.permission_catalog(key,description,default_roles) values
  ('finance_view','View finance, cashbook and purchase invoices','{branch_manager}'),
  ('expenses','Record expenses','{branch_manager}'),
  ('day_closing','Close the day and reconcile cash','{branch_manager}'),
  ('catalogue_edit','Edit the product catalogue','{branch_manager}'),
  ('reports_view','View reports','{branch_manager}'),
  ('crm_manage','Manage CRM automation','{branch_manager}'),
  ('discount_override','Override staff discount limits','{branch_manager}'),
  ('stock_adjust','Adjust stock manually','{branch_manager}'),
  ('purchases_manage','Create and receive purchase orders','{branch_manager}'),
  ('stock_audit','Run and approve stock counts','{branch_manager}'),
  ('transfers_approve','Approve branch stock transfers','{branch_manager}'),
  ('web_orders','Manage online order fulfilment','{branch_manager}'),
  ('credit_notes.issue','Issue credit notes and refunds','{branch_manager}')
on conflict(key) do update set description=excluded.description, default_roles=excluded.default_roles;
alter table public.permission_catalog enable row level security;
drop policy if exists pc_read on public.permission_catalog;
create policy pc_read on public.permission_catalog for select to authenticated using (public.current_org() is not null);
revoke insert,update,delete on public.permission_catalog from anon,authenticated;
grant select on public.permission_catalog to authenticated;

alter table public.role_permissions add column if not exists allowed boolean not null default true;
alter table public.role_permissions add column if not exists updated_by uuid default auth.uid();
alter table public.role_permissions add column if not exists updated_at timestamptz not null default now();
alter table public.role_permissions enable row level security;
drop policy if exists roleperm_sel on public.role_permissions;
create policy roleperm_sel on public.role_permissions for select to authenticated using (org_id=public.current_org());
revoke insert,update,delete on public.role_permissions from anon,authenticated;
grant select on public.role_permissions to authenticated;
alter table public.role_permissions drop constraint if exists role_permissions_permission_check;
-- Migrate legacy permission strings, first keeping the stricter value if an
-- organisation already has both the legacy and current form.
update public.role_permissions current_row set allowed = current_row.allowed and legacy.allowed
from public.role_permissions legacy
where legacy.org_id=current_row.org_id and legacy.role_key=current_row.role_key
  and case legacy.permission when 'finance.view' then 'finance_view' when 'finance.manage' then 'day_closing'
    when 'expenses.manage' then 'expenses' when 'purchases.manage' then 'purchases_manage' end = current_row.permission;
delete from public.role_permissions legacy using public.role_permissions current_row
where legacy.org_id=current_row.org_id and legacy.role_key=current_row.role_key
  and case legacy.permission when 'finance.view' then 'finance_view' when 'finance.manage' then 'day_closing'
    when 'expenses.manage' then 'expenses' when 'purchases.manage' then 'purchases_manage' end = current_row.permission;
update public.role_permissions set permission = case permission
  when 'finance.view' then 'finance_view' when 'finance.manage' then 'day_closing'
  when 'expenses.manage' then 'expenses' when 'purchases.manage' then 'purchases_manage' else permission end
where permission in ('finance.view','finance.manage','expenses.manage','purchases.manage');
-- Every role_permissions value has just been rewritten to the current names, so
-- nothing references the dotted keys any more. Retiring them from the catalogue
-- stops the default-role cross join below from seeding rows the new check
-- constraint rejects, and stops set_role_permission() offering names the column
-- can no longer store.
delete from public.permission_catalog
where key in ('finance.view','finance.manage','expenses.manage','purchases.manage');
alter table public.role_permissions add constraint role_permissions_permission_check
  check (permission in ('finance_view','expenses','day_closing','catalogue_edit','reports_view','crm_manage','discount_override','stock_adjust','purchases_manage','stock_audit','transfers_approve','web_orders','credit_notes.issue'));
insert into public.role_permissions(org_id,role_key,permission,allowed)
select o.id, r, c.key, true from public.organizations o
cross join public.permission_catalog c cross join lateral unnest(c.default_roles) r
where r in ('branch_manager','staff')
on conflict(org_id,role_key,permission) do nothing;
create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path=public as $$
  select public.has_perm(case p when 'finance.view' then 'finance_view' when 'finance.manage' then 'day_closing'
    when 'expenses.manage' then 'expenses' when 'purchases.manage' then 'purchases_manage' else p end)
$$;
create or replace function public.set_role_permission(p_role text, p_permission text, p_allowed boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can change permissions' using errcode='42501'; end if;
  if p_role not in ('branch_manager','staff') or p_allowed is null or not exists(select 1 from public.permission_catalog where key=p_permission) then
    raise exception 'Invalid role permission';
  end if;
  insert into public.role_permissions(org_id,role_key,permission,allowed)
  values(public.current_org(),p_role,p_permission,p_allowed)
  on conflict(org_id,role_key,permission) do update set allowed=excluded.allowed,updated_by=auth.uid(),updated_at=now();
end $$;
revoke execute on function public.set_role_permission(text,text,boolean) from public,anon;
grant execute on function public.set_role_permission(text,text,boolean) to authenticated;
create or replace function public.my_permissions() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p), '{}') from unnest(array['finance_view','expenses','day_closing','catalogue_edit','reports_view','crm_manage','discount_override','stock_adjust','purchases_manage','stock_audit','transfers_approve','web_orders','credit_notes.issue']) p where public.has_perm(p)
$$;

-- Billing foundation only: no plan amounts or live subscription are invented here.
create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default false,
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency text not null default 'INR',
  interval text not null default 'month' check (interval in ('month','year')),
  entitlements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.billing_plans(id),
  status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','cancelled')),
  provider text check (provider is null or provider = 'razorpay'),
  provider_subscription_id text unique,
  current_period_start timestamptz, current_period_end timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.billing_plans enable row level security;
alter table public.org_subscriptions enable row level security;
revoke all on public.billing_plans, public.org_subscriptions from anon, authenticated;
grant select on public.billing_plans to authenticated;
grant select, insert, update on public.org_subscriptions to service_role;

-- Keep importer supplied SKU values (including the database sample catalogue).
-- Products without an SKU still receive the existing sequence generated value.
create or replace function public.products_before() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' then
    new.sku := coalesce(nullif(trim(new.sku), ''), public.next_code(new.org_id, 'sku_' || new.kind,
      case new.kind when 'frame' then 'FRM-' when 'sunglass' then 'SUN-' when 'contact_lens' then 'CL-' else 'ACC-' end));
    new.barcode := coalesce(nullif(new.barcode, ''), new.sku);
  else
    new.sku := old.sku;
    new.updated_at := now();
  end if;
  return new;
end $$;

create index if not exists stock_audit_branch_status on public.stock_audit_sessions(org_id, branch_id, status, created_at desc);
create index if not exists stock_audit_lines_session on public.stock_audit_lines(session_id);

-- CRM messages inherit the customer's home branch for switcher filtering.
alter table public.whatsapp_log add column if not exists branch_id uuid references public.branches(id);
update public.whatsapp_log w set branch_id=c.branch_id from public.customers c where c.id=w.customer_id and w.branch_id is null;
create or replace function public.set_whatsapp_log_branch() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.branch_id is null and new.customer_id is not null then select branch_id into new.branch_id from public.customers where id=new.customer_id and org_id=new.org_id; end if;
  return new;
end $$;
drop trigger if exists trg_whatsapp_log_branch on public.whatsapp_log;
create trigger trg_whatsapp_log_branch before insert on public.whatsapp_log for each row execute function public.set_whatsapp_log_branch();
create index if not exists whatsapp_log_branch_sent on public.whatsapp_log(org_id,branch_id,sent_at desc);
drop policy if exists wa_log_branch_scope on public.whatsapp_log;
create policy wa_log_branch_scope on public.whatsapp_log as restrictive for all to authenticated
  using (branch_id is null or public.can_access_branch(branch_id))
  with check (branch_id is null or public.can_access_branch(branch_id));

create table if not exists public.catalogue_sample_templates (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('frame','sunglass','contact_lens','accessory')),
  brand text not null, model text not null, sku text not null,
  gender text not null, mrp numeric(10,2) not null, selling_price numeric(10,2) not null,
  tax_pct numeric(4,1) not null, cost_price numeric(10,2) not null,
  unique(kind, sku)
);
alter table public.catalogue_sample_templates enable row level security;
drop policy if exists catalogue_sample_templates_read on public.catalogue_sample_templates;
create policy catalogue_sample_templates_read on public.catalogue_sample_templates for select to authenticated using (true);
grant select on public.catalogue_sample_templates to authenticated;
insert into public.catalogue_sample_templates(kind,brand,model,sku,gender,mrp,selling_price,tax_pct,cost_price) values
 ('frame','Sample Studio','Acetate Round Black','DEMO-FRM-001','unisex',2499,1999,5,900),
 ('frame','Sample Studio','Metal Rectangle Gunmetal','DEMO-FRM-002','men',2999,2399,5,1120),
 ('frame','Sample Studio','Lightweight Oval Rose','DEMO-FRM-003','women',3299,2699,5,1250),
 ('sunglass','Sunline','Aviator Gold Green','DEMO-SUN-001','unisex',3499,2799,5,1320),
 ('sunglass','Sunline','Wayfarer Black Polarized','DEMO-SUN-002','men',3999,3199,5,1550),
 ('sunglass','Sunline','Cat Eye Tortoise','DEMO-SUN-003','women',3799,2999,5,1440),
 ('contact_lens','ClearView','Monthly Clear 3 Pack','DEMO-CL-001','unisex',999,799,12,390),
 ('contact_lens','ClearView','Daily Comfort 30 Pack','DEMO-CL-002','unisex',1899,1599,12,820),
 ('contact_lens','ClearView','Monthly Toric 3 Pack','DEMO-CL-003','unisex',1599,1299,12,640),
 ('accessory','OptiCare','Microfiber Cleaning Kit','DEMO-ACC-001','unisex',299,199,18,65),
 ('accessory','OptiCare','Hard Case Navy','DEMO-ACC-002','unisex',399,249,18,90),
 ('accessory','OptiCare','Anti Fog Lens Spray','DEMO-ACC-003','unisex',349,229,18,80)
on conflict(kind,sku) do nothing;

-- Only the trusted server can invoke the storefront channel. It is the sole
-- channel allowed to apply catalogue-backed coupon discounts beyond staff caps.
do $$
declare definition text; original text := $old$if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin') then$old$;
begin
  select pg_get_functiondef('public.place_sale(jsonb)'::regprocedure) into definition;
  if definition is null then raise exception 'place_sale(jsonb) is required before this migration'; end if;
  if position($check$p->>'channel' = 'storefront'$check$ in definition) = 0 then
    definition := replace(definition, original,
      $new$if v_disc > v_maxdisc and coalesce(v_role,'') not in ('owner','admin') and not public.has_perm('discount_override') and not (auth.uid() is null and p->>'channel' = 'storefront') then$new$);
    if position($check$p->>'channel' = 'storefront'$check$ in definition) = 0 then
      raise exception 'Could not patch the discount guard in place_sale(jsonb)';
    end if;
    execute definition;
  end if;
end $$;
revoke all on function public.place_sale(jsonb) from public, anon;
grant execute on function public.place_sale(jsonb) to authenticated, service_role;
