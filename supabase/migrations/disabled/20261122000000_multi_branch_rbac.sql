-- PowerOS multi-organisation / multi-branch RBAC hardening
-- Roles: owner, admin (= Company Admin), branch_manager, staff.
-- Safe to re-run. Existing data is preserved (see backfill notes).

-- ───────────────────────────── 1. Roles & identity helpers ─────────────────────────────
alter table profiles drop constraint if exists profiles_role_key_chk;
alter table profiles add constraint profiles_role_key_chk
  check (role_key in ('owner','admin','branch_manager','staff')) not valid;  -- legacy rows untouched, new writes enforced

-- A deactivated login must lose ALL access at the database level (previously only is_approved was flipped by the UI).
create or replace function public.current_org() returns uuid language sql stable security definer set search_path = public as
$$ select org_id from profiles where id = auth.uid() and is_approved and not deactivated $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and is_approved and not deactivated and role_key in ('owner','admin')) $$;

create or replace function public.current_role_key() returns text language sql stable security definer set search_path = public as
$$ select role_key from profiles where id = auth.uid() and is_approved and not deactivated $$;

-- ───────────────────────────── 2. Branch assignments (permanent + temporary) ─────────────────────────────
create table if not exists user_branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id),
  kind text not null default 'permanent' check (kind in ('permanent','temporary')),
  expires_at timestamptz, reason text,
  granted_by uuid default auth.uid(), created_at timestamptz not null default now(),
  unique (user_id, branch_id),
  check ((kind = 'temporary') = (expires_at is not null)));
create index if not exists user_branches_user on user_branches (user_id);
alter table user_branches enable row level security;
drop policy if exists ub_select on user_branches;
create policy ub_select on user_branches for select using (
  org_id = public.current_org() and (user_id = auth.uid() or public.current_role_key() in ('owner','admin','branch_manager')));
revoke insert, update, delete on user_branches from anon, authenticated;   -- writes only via RPCs below

-- Backfill: legacy staff with no branch meant "all branches" in the old UI. Preserve that access explicitly
-- (admins can tighten it afterwards) so no existing user is locked out by this migration.
insert into user_branches (org_id, user_id, branch_id, kind)
select p.org_id, p.id, b.id, 'permanent'
from profiles p join branches b on b.org_id = p.org_id and b.is_active
where p.is_approved and not p.deactivated and p.role_key in ('staff','branch_manager') and p.branch_id is null
on conflict (user_id, branch_id) do nothing;
insert into user_branches (org_id, user_id, branch_id, kind)
select org_id, id, branch_id, 'permanent' from profiles
where is_approved and branch_id is not null and org_id is not null and role_key in ('staff','branch_manager')
on conflict (user_id, branch_id) do nothing;

create or replace function public.can_access_branch(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join branches br on br.id = b and br.org_id = p.org_id
    where p.id = auth.uid() and p.is_approved and not p.deactivated
      and (p.role_key in ('owner','admin')
        or exists (select 1 from user_branches ub where ub.user_id = p.id and ub.branch_id = b
                   and (ub.expires_at is null or ub.expires_at > now()))))
$$;

-- ───────────────────────────── 3. Branch scoping at database level ─────────────────────────────
-- Enforcement #1 (RLS, restrictive = ANDed with every existing policy): hides/blocks other branches' rows.
-- Enforcement #2 (trigger): also stops SECURITY DEFINER functions (cancel_order, deliver_order, credit notes,
--   lab advance …) which bypass RLS. Service-role (auth.uid() null) and customer-portal logins are unaffected.
create or replace function public.enforce_branch_scope() returns trigger language plpgsql set search_path = public as $$
declare b uuid := case when tg_op = 'DELETE' then old.branch_id else new.branch_id end;
begin
  if auth.uid() is not null and public.current_org() is not null and b is not null and not public.can_access_branch(b) then
    raise exception 'Access denied: you are not assigned to this branch' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.apply_branch_scope(t regclass) returns void language plpgsql as $$
begin
  execute format('drop policy if exists branch_scope on %s', t);
  execute format($f$create policy branch_scope on %s as restrictive for all
    using (public.current_org() is null or branch_id is null or public.can_access_branch(branch_id))
    with check (public.current_org() is null or branch_id is null or public.can_access_branch(branch_id))$f$, t);
  execute format('drop trigger if exists trg_00_branch_scope on %s', t);
  execute format('create trigger trg_00_branch_scope before insert or update or delete on %s for each row execute function public.enforce_branch_scope()', t);
end $$;

do $$ declare t regclass; begin
  for t in
    select k.oid::regclass from pg_class k
    where k.relnamespace = 'public'::regnamespace and k.relkind = 'r' and k.relrowsecurity
      and k.relname not in ('customers','branches','profiles','user_branches','audit_log','counters','organizations')
      and exists (select 1 from pg_attribute a where a.attrelid = k.oid and a.attname = 'branch_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid = k.oid and a.attname = 'org_id' and not a.attisdropped)
  loop perform public.apply_branch_scope(t); end loop;
  -- child rows without their own branch_id inherit the parent's branch visibility
  if to_regclass('public.sale_lines') is not null then
    drop policy if exists branch_scope on sale_lines;
    create policy branch_scope on sale_lines as restrictive for all
      using (public.current_org() is null or exists (select 1 from sales s where s.id = sale_id))
      with check (public.current_org() is null or exists (select 1 from sales s where s.id = sale_id));
  end if;
end $$;

-- ───────────────────────────── 4. Cross-tenant leaks: views ran as owner and bypassed RLS ─────────────────────────────
alter view if exists customer_orders set (security_invoker = true);
alter view if exists public.itc_summary set (security_invoker = true);
alter view if exists customer_loyalty_balance set (security_invoker = true);

-- Staff of one org could bump another org's counters through the definer function.
create or replace function public.next_code(p_org uuid, p_key text, p_prefix text) returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.current_org() is not null and p_org is distinct from public.current_org() then
    raise exception 'Access denied' using errcode = '42501'; end if;
  insert into counters(org_id,key,value) values (p_org,p_key,1)
  on conflict (org_id,key) do update set value = counters.value + 1 returning value into n;
  return p_prefix || lpad(n::text, 4, '0');
end $$;

-- ───────────────────────────── 5. Staff invitations ─────────────────────────────
create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  email text not null, role_key text not null check (role_key in ('admin','branch_manager','staff')),
  branch_ids uuid[] not null default '{}',
  invited_by uuid default auth.uid(), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_user_id uuid references profiles(id), accepted_at timestamptz, revoked_at timestamptz);
create unique index if not exists staff_inv_open on staff_invitations (org_id, lower(email)) where accepted_at is null and revoked_at is null;
alter table staff_invitations enable row level security;
drop policy if exists si_select on staff_invitations;
create policy si_select on staff_invitations for select using (org_id = public.current_org() and public.is_admin());
revoke insert, update, delete on staff_invitations from anon, authenticated;

-- Staff sign-up: org comes ONLY from a matching invitation (never from client metadata). Uninvited staff
-- sign-ups stay org-less/unapproved and see nothing. Approval still requires an admin + verified email.
create or replace function public.sync_auth_to_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid := '00000000-0000-0000-0000-000000000001'; v_br uuid; v_name text; v_phone text; v_inv staff_invitations%rowtype;
begin
  if (new.raw_user_meta_data->>'is_staff') = 'true' then
    select * into v_inv from staff_invitations where lower(email) = lower(new.email)
      and accepted_at is null and revoked_at is null and expires_at > now() limit 1;
    insert into profiles (id, full_name, org_id)
    values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)), v_inv.org_id)
    on conflict (id) do nothing;
    if v_inv.id is not null then
      update staff_invitations set accepted_user_id = new.id, accepted_at = now() where id = v_inv.id; end if;
    return new;
  end if;
  if exists (select 1 from customers where auth_user_id = new.id) then return new; end if;
  select id into v_br from branches where org_id = v_org and is_active order by name limit 1;
  v_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''), '');
  insert into customers (org_id, branch_id, full_name, phone, email, auth_user_id, city, state, pincode, notes)
  values (v_org, v_br, v_name, v_phone, new.email, new.id, 'Chennai','Tamil Nadu','600037','Auto-created from website portal');
  return new;
end $$;

-- ───────────────────────────── 6. Staff management RPCs (the only write path for roles/branches/status) ─────────────────────────────
revoke insert, update, delete on profiles from anon, authenticated;   -- closes any future permissive UPDATE policy from self-promoting

create or replace function public._staff_guard(p_target uuid, p_new_role text default null) returns uuid language plpgsql stable security definer set search_path = public as $$
declare me profiles%rowtype; tg profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  if me.id is null or me.role_key not in ('owner','admin') then raise exception 'Only owners and company admins can manage staff' using errcode='42501'; end if;
  select * into tg from profiles where id = p_target;
  if tg.id is null or tg.org_id is distinct from me.org_id then raise exception 'Staff member not found in your organisation' using errcode='42501'; end if;
  if me.role_key = 'admin' and (tg.role_key in ('owner','admin') or p_new_role in ('owner','admin')) and tg.id <> me.id then
    raise exception 'Only an owner can manage owners and company admins' using errcode='42501'; end if;
  if p_new_role is not null and p_new_role not in ('owner','admin','branch_manager','staff') then raise exception 'Unknown role'; end if;
  if p_new_role = 'owner' and me.role_key <> 'owner' then raise exception 'Only an owner can grant owner' using errcode='42501'; end if;
  return me.org_id;
end $$;

create or replace function public._assert_other_owner(p_target uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where org_id = (select org_id from profiles where id = p_target)
       and role_key = 'owner' and is_approved and not deactivated and id <> p_target) then
    raise exception 'An organisation must keep at least one active owner'; end if;
end $$;

create or replace function public._set_branches(p_org uuid, p_user uuid, p_ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from unnest(p_ids) i where not exists (select 1 from branches where id = i and org_id = p_org and is_active)) then
    raise exception 'One or more branches are invalid for this organisation'; end if;
  delete from user_branches where user_id = p_user and kind = 'permanent';
  insert into user_branches (org_id, user_id, branch_id) select p_org, p_user, i from unnest(p_ids) i
    on conflict (user_id, branch_id) do update set kind='permanent', expires_at=null, reason=null;
  update profiles set branch_id = p_ids[1] where id = p_user;
end $$;

create or replace function public.approve_staff(p_user uuid, p_role text, p_branch_ids uuid[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public._staff_guard(p_user, p_role);
begin
  if not exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
    raise exception 'The staff member must verify their email first'; end if;
  if p_role in ('branch_manager','staff') and coalesce(array_length(p_branch_ids,1),0) = 0 then
    raise exception 'Assign at least one branch'; end if;
  update profiles set is_approved = true, deactivated = false, role_key = p_role where id = p_user;
  if p_role in ('branch_manager','staff') then perform public._set_branches(v_org, p_user, p_branch_ids);
  else delete from user_branches where user_id = p_user and kind = 'permanent'; update profiles set branch_id = null where id = p_user; end if;
end $$;

create or replace function public.set_staff_role(p_user uuid, p_role text) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public._staff_guard(p_user, p_role); v_old text;
begin
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  select role_key into v_old from profiles where id = p_user;
  if v_old = 'owner' and p_role <> 'owner' then perform public._assert_other_owner(p_user); end if;
  update profiles set role_key = p_role where id = p_user;
  if p_role in ('owner','admin') then delete from user_branches where user_id = p_user and kind = 'permanent'; end if;
end $$;

create or replace function public.set_staff_branches(p_user uuid, p_ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public._staff_guard(p_user);
begin
  if coalesce(array_length(p_ids,1),0) = 0 then raise exception 'Assign at least one branch'; end if;
  perform public._set_branches(v_org, p_user, p_ids);
end $$;

create or replace function public.set_staff_active(p_user uuid, p_active boolean) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public._staff_guard(p_user);
begin
  if p_user = auth.uid() then raise exception 'You cannot deactivate yourself'; end if;
  if not p_active and (select role_key from profiles where id = p_user) = 'owner' then perform public._assert_other_owner(p_user); end if;
  update profiles set deactivated = not p_active, is_approved = p_active where id = p_user;
  if not p_active then delete from user_branches where user_id = p_user and kind = 'temporary'; end if;
end $$;

create or replace function public.invite_staff(p_email text, p_role text, p_branch_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles%rowtype; v_id uuid;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  if me.id is null or me.role_key not in ('owner','admin') then raise exception 'Only owners and company admins can invite staff' using errcode='42501'; end if;
  if p_role not in ('admin','branch_manager','staff') or (p_role = 'admin' and me.role_key <> 'owner') then
    raise exception 'You cannot invite that role' using errcode='42501'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role <> 'admin' and coalesce(array_length(p_branch_ids,1),0) = 0 then raise exception 'Assign at least one branch'; end if;
  if exists (select 1 from unnest(p_branch_ids) i where not exists (select 1 from branches where id = i and org_id = me.org_id)) then
    raise exception 'Invalid branch'; end if;
  insert into staff_invitations (org_id, email, role_key, branch_ids) values (me.org_id, lower(trim(p_email)), p_role, p_branch_ids) returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only owners and company admins can revoke invitations' using errcode='42501'; end if;
  update staff_invitations set revoked_at = now() where id = p_id and org_id = public.current_org() and accepted_at is null;
end $$;

-- Temporary cross-branch assignment. Admins: up to 365 days, any staff. Branch managers: up to 30 days, plain staff, only for branches they hold.
create or replace function public.grant_temp_branch(p_user uuid, p_branch uuid, p_expires timestamptz, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles%rowtype; tg profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  select * into tg from profiles where id = p_user and is_approved and not deactivated;
  if me.id is null or tg.id is null or me.org_id is distinct from tg.org_id then raise exception 'Not found' using errcode='42501'; end if;
  if not exists (select 1 from branches where id = p_branch and org_id = me.org_id and is_active) then raise exception 'Invalid branch'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'A reason is required'; end if;
  if p_expires is null or p_expires <= now() then raise exception 'Expiry must be in the future'; end if;
  if me.role_key in ('owner','admin') then
    if p_expires > now() + interval '365 days' then raise exception 'Maximum 365 days'; end if;
  elsif me.role_key = 'branch_manager' then
    if tg.role_key <> 'staff' or not public.can_access_branch(p_branch) then raise exception 'Not permitted' using errcode='42501'; end if;
    if p_expires > now() + interval '30 days' then raise exception 'Managers can grant at most 30 days'; end if;
  else raise exception 'Not permitted' using errcode='42501'; end if;
  insert into user_branches (org_id, user_id, branch_id, kind, expires_at, reason) values (me.org_id, p_user, p_branch, 'temporary', p_expires, p_reason)
  on conflict (user_id, branch_id) do update set expires_at = excluded.expires_at, reason = excluded.reason, granted_by = auth.uid(), kind = 'temporary'
    where user_branches.kind = 'temporary';   -- never downgrade a permanent assignment
end $$;

create or replace function public.revoke_branch_access(p_user uuid, p_branch uuid) returns void language plpgsql security definer set search_path = public as $$
declare me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid() and is_approved and not deactivated;
  if me.role_key not in ('owner','admin') and not (me.role_key = 'branch_manager' and public.can_access_branch(p_branch)) then
    raise exception 'Not permitted' using errcode='42501'; end if;
  delete from user_branches where user_id = p_user and branch_id = p_branch and org_id = me.org_id
    and (kind = 'temporary' or me.role_key in ('owner','admin'));
end $$;

-- ───────────────────────────── 7. Cross-branch stock transfers ─────────────────────────────
create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  from_branch uuid not null references branches(id), to_branch uuid not null references branches(id),
  status text not null default 'requested' check (status in ('requested','in_transit','received','rejected','cancelled')),
  note text, requested_by uuid not null default auth.uid(), approved_by uuid, received_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (from_branch <> to_branch));
create table if not exists stock_transfer_lines (
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid not null references products(id), qty int not null check (qty > 0),
  primary key (transfer_id, product_id));
alter table stock_transfers enable row level security;
alter table stock_transfer_lines enable row level security;
drop policy if exists st_select on stock_transfers;
create policy st_select on stock_transfers for select using (org_id = public.current_org() and (public.can_access_branch(from_branch) or public.can_access_branch(to_branch)));
drop policy if exists stl_select on stock_transfer_lines;
create policy stl_select on stock_transfer_lines for select using (exists (select 1 from stock_transfers t where t.id = transfer_id));
revoke insert, update, delete on stock_transfers, stock_transfer_lines from anon, authenticated;
drop trigger if exists trg_stock_transfers_audit on stock_transfers;
create trigger trg_stock_transfers_audit after insert or update on stock_transfers for each row execute function audit_row();

create or replace function public.request_stock_transfer(p_from uuid, p_to uuid, p_lines jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org(); v_id uuid; l jsonb;
begin
  if v_org is null then raise exception 'Only approved staff can request transfers' using errcode='42501'; end if;
  if p_from = p_to then raise exception 'Choose two different branches'; end if;
  if not (public.can_access_branch(p_from) or public.can_access_branch(p_to)) then raise exception 'You must belong to one of the branches' using errcode='42501'; end if;
  if (select count(*) from branches where id in (p_from,p_to) and org_id = v_org and is_active) <> 2 then raise exception 'Invalid branches'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Add at least one product'; end if;
  insert into stock_transfers (org_id, from_branch, to_branch, note) values (v_org, p_from, p_to, p_note) returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    if (l->>'qty')::int <= 0 or not exists (select 1 from products where id = (l->>'product_id')::uuid and org_id = v_org) then raise exception 'Invalid line'; end if;
    insert into stock_transfer_lines (transfer_id, product_id, qty) values (v_id, (l->>'product_id')::uuid, (l->>'qty')::int);
  end loop;
  return v_id;
end $$;

-- Approve = dispatch: stock leaves the source branch now (stock check constraint rejects shortages).
create or replace function public.approve_stock_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t stock_transfers%rowtype; r record; v_role text := public.current_role_key();
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'requested' then raise exception 'Transfer is not awaiting approval'; end if;
  if not (v_role in ('owner','admin') or (v_role = 'branch_manager' and public.can_access_branch(t.from_branch))) then
    raise exception 'Only the source branch manager or an admin can approve' using errcode='42501'; end if;
  if t.requested_by = auth.uid() and v_role <> 'owner' then raise exception 'You cannot approve your own request' using errcode='42501'; end if;
  for r in select * from stock_transfer_lines where transfer_id = p_id loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, r.product_id, -r.qty, 'transfer_out', 'Transfer ' || left(p_id::text, 8));
  end loop;
  update stock_transfers set status = 'in_transit', approved_by = auth.uid(), updated_at = now() where id = p_id;
end $$;

create or replace function public.receive_stock_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t stock_transfers%rowtype; r record;
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'in_transit' then raise exception 'Transfer is not in transit'; end if;
  if not public.can_access_branch(t.to_branch) then raise exception 'Only the receiving branch can receive stock' using errcode='42501'; end if;
  for r in select * from stock_transfer_lines where transfer_id = p_id loop
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.to_branch, r.product_id, r.qty, 'transfer_in', 'Transfer ' || left(p_id::text, 8));
  end loop;
  update stock_transfers set status = 'received', received_by = auth.uid(), updated_at = now() where id = p_id;
end $$;

create or replace function public.close_stock_transfer(p_id uuid, p_reject boolean default false) returns void language plpgsql security definer set search_path = public as $$
declare t stock_transfers%rowtype; v_role text := public.current_role_key();
begin
  select * into t from stock_transfers where id = p_id and org_id = public.current_org() for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'requested' then raise exception 'Only requests awaiting approval can be closed'; end if;
  if p_reject then
    if not (v_role in ('owner','admin') or (v_role = 'branch_manager' and public.can_access_branch(t.from_branch))) then raise exception 'Not permitted' using errcode='42501'; end if;
  elsif t.requested_by <> auth.uid() and v_role not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
  update stock_transfers set status = case when p_reject then 'rejected' else 'cancelled' end, updated_at = now() where id = p_id;
end $$;

-- ───────────────────────────── 8. Audit coverage & immutability ─────────────────────────────
drop trigger if exists trg_profiles_audit on profiles;
create trigger trg_profiles_audit after insert or update or delete on profiles for each row execute function audit_row();
drop trigger if exists trg_user_branches_audit on user_branches;
create trigger trg_user_branches_audit after insert or update or delete on user_branches for each row execute function audit_row();
drop trigger if exists trg_staff_inv_audit on staff_invitations;
create trigger trg_staff_inv_audit after insert or update on staff_invitations for each row execute function audit_row();

create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists trg_audit_immutable on audit_log;
create trigger trg_audit_immutable before update or delete on audit_log for each row execute function public.audit_log_immutable();
revoke update, delete on audit_log from anon, authenticated;
-- audit_row() writes the acting user (auth.uid()) via column default; DB-side writes by RPCs therefore carry the actor.

-- ───────────────────────────── 9. Shared customer identity ─────────────────────────────
-- Customers stay organisation-wide (one identity, one Vision ID across branches); sales/stock/finance are branch-scoped above.
-- Phone is deliberately NOT unique (families share numbers; a unique index would break website sign-ups via the auth trigger).
create index if not exists customers_org_phone_idx on customers (org_id, phone);
