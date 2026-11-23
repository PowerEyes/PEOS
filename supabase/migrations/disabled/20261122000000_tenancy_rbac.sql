-- PowerOS tenancy + RBAC hardening.
-- Roles: owner > admin (company admin) > branch_manager > staff.
-- Customers/prescriptions/catalogue are org-shared; sales, stock, lab, repairs, appointments, finance are branch-scoped.
-- Every privileged mutation goes through a SECURITY DEFINER RPC that checks the caller; direct writes to
-- profiles / assignments / invitations / transfers are revoked. Everything sensitive lands in audit_log.

-- ── 0. Roles & data compatibility ───────────────────────────────────────────────
update profiles set role_key = 'branch_manager' where role_key in ('manager', 'branch-manager');
update profiles set role_key = 'staff' where role_key not in ('owner', 'admin', 'branch_manager', 'staff');
alter table profiles drop constraint if exists profiles_role_key_chk;
alter table profiles add constraint profiles_role_key_chk check (role_key in ('owner', 'admin', 'branch_manager', 'staff'));
alter table profiles add column if not exists branch_reviewed boolean not null default true;
-- Branch scoping would hide everything from approved non-admin staff with no home branch: give them the
-- org's first active branch (admins can reassign in Staff). Reported in the readiness doc.
update profiles p set branch_reviewed = false, branch_id = (select b.id from branches b where b.org_id = p.org_id and b.is_active order by b.code limit 1)
 where p.is_approved and p.branch_id is null and p.org_id is not null and p.role_key in ('branch_manager', 'staff');

-- ── 1. New tables ───────────────────────────────────────────────────────────────
create table if not exists staff_assignments (            -- authorised TEMPORARY access to another branch
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  profile_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reason text not null check (length(trim(reason)) > 2),
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid,
  check (ends_at > starts_at and ends_at <= starts_at + interval '90 days'));
create index if not exists idx_assign_profile on staff_assignments (profile_id, branch_id);

create table if not exists staff_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  email text not null, role_key text not null check (role_key in ('admin', 'branch_manager', 'staff')),
  branch_id uuid references branches(id),
  invited_by uuid default auth.uid(), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz, accepted_by uuid, revoked_at timestamptz);
create unique index if not exists uq_invite_open on staff_invitations (org_id, lower(email)) where accepted_at is null and revoked_at is null;

create table if not exists branch_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  from_branch uuid not null references branches(id), to_branch uuid not null references branches(id),
  product_id uuid not null references products(id), qty int not null check (qty > 0),
  status text not null default 'requested' check (status in ('requested', 'in_transit', 'received', 'rejected', 'cancelled')),
  note text, requested_by uuid default auth.uid(), approved_by uuid, received_by uuid,
  created_at timestamptz not null default now(), approved_at timestamptz, received_at timestamptz,
  check (from_branch <> to_branch));
create index if not exists idx_transfers_branches on branch_transfers (from_branch, to_branch, status);

create table if not exists platform_admins (user_id uuid primary key references auth.users(id) on delete cascade); -- service-role managed

-- ── 2. Access helpers ───────────────────────────────────────────────────────────
create or replace function public.current_org() returns uuid language sql stable security definer set search_path = public as
$$ select org_id from profiles where id = auth.uid() and is_approved and not deactivated $$;
create or replace function public.current_role_key() returns text language sql stable security definer set search_path = public as
$$ select role_key from profiles where id = auth.uid() and is_approved and not deactivated $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_key() in ('owner', 'admin'), false) $$;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_key() in ('owner', 'admin', 'branch_manager'), false) $$;
create or replace function public.can_access_branch(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select exists (select 1 from branches br where br.id = b and br.org_id = p.org_id) and (
      p.role_key in ('owner', 'admin') or p.branch_id = b
      or exists (select 1 from staff_assignments a where a.profile_id = p.id and a.branch_id = b
                 and a.revoked_at is null and a.starts_at <= now() and a.ends_at > now()))
    from profiles p where p.id = auth.uid() and p.is_approved and not p.deactivated), false) $$;

-- Defence in depth for SECURITY DEFINER code paths (place_sale, lab advance, …) that bypass RLS:
-- a signed-in user can never write a row of a branch they cannot access. Service role (auth.uid() null) is trusted.
create or replace function public.enforce_branch_write() returns trigger language plpgsql security definer set search_path = public as $$
declare v_b uuid := nullif(to_jsonb(new)->>'branch_id', '')::uuid;
begin
  if auth.uid() is null or v_b is null then return new; end if;
  if not public.can_access_branch(v_b) then raise exception 'Not authorised for this branch' using errcode = '42501'; end if;
  return new;
end $$;

-- ── 3. Branch-scoped, role-aware RLS (replaces org-only policies) ───────────────
do $$
declare
  BR  text := 'org_id = public.current_org() and public.can_access_branch(branch_id)';
  MBR text := 'org_id = public.current_org() and public.can_access_branch(branch_id) and public.is_manager()';
  ORG text := 'org_id = public.current_org()';
  MGR text := 'org_id = public.current_org() and public.is_manager()';
  r record; p record; c text;
begin
  create temp table _pol (tbl text, rd text, ins text, upd text, del text) on commit drop;
  insert into _pol values
    ('sales', BR, BR, BR, null), ('lab_orders', BR, BR, BR, null), ('appointments', BR, BR, BR, null),
    ('repairs', BR, BR, BR, BR || ' and status = ''pending'''), ('eye_examinations', BR, BR, BR, MBR),
    ('stock', BR, MBR, MBR, null), ('stock_movements', BR, BR, null, null), ('credit_notes', BR, BR, BR, null),
    ('cashbook', MBR, null, null, null), ('expenses', MBR, MBR, MBR, null), ('day_closings', MBR, MBR, MBR, null),
    ('purchase_invoices', MBR, MBR, MBR, null), ('gst_periods', MGR, MGR, MGR, null),
    ('suppliers', ORG, MGR, MGR, null), ('products', ORG, MGR, MGR, null), ('brands', ORG, MGR, MGR, null),
    ('lens_packages', ORG, MGR, MGR, null), ('lens_options', ORG, MGR, MGR, null);
  -- child tables follow their parent's (already scoped) visibility
  for r in select * from (values ('sale_lines','sale_id','sales'), ('payments','sale_id','sales'), ('repair_events','repair_id','repairs'),
      ('lab_events','lab_order_id','lab_orders'), ('purchase_items','purchase_id','purchase_invoices'), ('credit_note_lines','credit_note_id','credit_notes')) v(t, fk, par) loop
    c := format('org_id = public.current_org() and exists (select 1 from %I par where par.id = %I)', r.par, r.fk);
    insert into _pol values (r.t, c, c, case when r.t in ('sale_lines','payments','credit_note_lines') then c end, null);
  end loop;

  for r in select * from _pol loop
    continue when to_regclass('public.' || r.tbl) is null;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = r.tbl
             and (coalesce(qual, '') ilike '%current_org()%' or coalesce(with_check, '') ilike '%current_org()%' or policyname like '%\_rls\_%') loop
      execute format('drop policy %I on %I', p.policyname, r.tbl);
    end loop;
    execute format('alter table %I enable row level security', r.tbl);
    execute format('create policy %I on %I for select to authenticated using (%s)', r.tbl || '_rls_sel', r.tbl, r.rd);
    if r.ins is not null then execute format('create policy %I on %I for insert to authenticated with check (%s)', r.tbl || '_rls_ins', r.tbl, r.ins); end if;
    if r.upd is not null then execute format('create policy %I on %I for update to authenticated using (%s) with check (%s)', r.tbl || '_rls_upd', r.tbl, r.upd, r.upd); end if;
    if r.del is not null then execute format('create policy %I on %I for delete to authenticated using (%s)', r.tbl || '_rls_del', r.tbl, r.del); end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.tbl and column_name = 'branch_id') then
      execute format('drop trigger if exists trg_branch_guard on %I', r.tbl);
      execute format('create trigger trg_branch_guard before insert or update on %I for each row execute function public.enforce_branch_write()', r.tbl);
    end if;
  end loop;

  -- Open `using (true)` policies found in review.
  if to_regclass('public.coupon_uses') is not null then
    drop policy if exists coupon_uses_staff on coupon_uses;
    create policy coupon_uses_staff on coupon_uses for all to authenticated
      using (exists (select 1 from coupons c where c.id = coupon_id and c.org_id = public.current_org()))
      with check (exists (select 1 from coupons c where c.id = coupon_id and c.org_id = public.current_org()));
  end if;
  if to_regclass('public.cron_runs') is not null then
    drop policy if exists cron_runs_staff on cron_runs;
    create policy cron_runs_staff on cron_runs for select to authenticated using (public.is_admin());
  end if;
end $$;

-- ── 4. New-table RLS: reads scoped, all writes only via RPC ─────────────────────
alter table staff_assignments enable row level security;
alter table staff_invitations enable row level security;
alter table branch_transfers enable row level security;
alter table platform_admins enable row level security;
drop policy if exists assign_sel on staff_assignments;
create policy assign_sel on staff_assignments for select to authenticated
  using (org_id = public.current_org() and (profile_id = auth.uid() or public.is_manager()));
drop policy if exists invite_sel on staff_invitations;
create policy invite_sel on staff_invitations for select to authenticated using (org_id = public.current_org() and public.is_admin());
drop policy if exists transfer_sel on branch_transfers;
create policy transfer_sel on branch_transfers for select to authenticated
  using (org_id = public.current_org() and (public.can_access_branch(from_branch) or public.can_access_branch(to_branch)));
revoke insert, update, delete on profiles, staff_assignments, staff_invitations, branch_transfers, platform_admins from anon, authenticated;
revoke all on platform_admins from anon, authenticated;
revoke insert, update, delete on audit_log from anon, authenticated;

-- ── 5. Audit: permission changes, assignments, invitations, transfers; log is append-only ──
create or replace function public.audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists trg_audit_immutable on audit_log;
create trigger trg_audit_immutable before update or delete on audit_log for each row execute function public.audit_immutable();
drop trigger if exists trg_profiles_audit on profiles;
create trigger trg_profiles_audit after insert or delete or update of role_key, branch_id, is_approved, deactivated, org_id on profiles for each row execute function audit_row();
drop trigger if exists trg_assign_audit on staff_assignments;
create trigger trg_assign_audit after insert or update or delete on staff_assignments for each row execute function audit_row();
drop trigger if exists trg_invite_audit on staff_invitations;
create trigger trg_invite_audit after insert or update or delete on staff_invitations for each row execute function audit_row();
drop trigger if exists trg_transfer_audit on branch_transfers;
create trigger trg_transfer_audit after insert or update or delete on branch_transfers for each row execute function audit_row();

-- ── 6. Staff lifecycle RPCs ─────────────────────────────────────────────────────
create or replace function public.admin_update_staff(p_id uuid, p_role text default null, p_branch uuid default null,
    p_set_branch boolean default false, p_deactivated boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare c profiles; t profiles; v_role text; v_deact boolean;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only owners and admins can manage staff' using errcode = '42501'; end if;
  select * into t from profiles where id = p_id and org_id = c.org_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if t.id = c.id and (p_role is not null or p_deactivated is true) then raise exception 'You cannot change your own role or deactivate yourself'; end if;
  if c.role_key <> 'owner' and (t.role_key in ('owner', 'admin') or p_role in ('owner', 'admin')) then
    raise exception 'Only an owner can manage or grant admin/owner access' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('owner', 'admin', 'branch_manager', 'staff') then raise exception 'Invalid role'; end if;
  v_role := coalesce(p_role, t.role_key); v_deact := coalesce(p_deactivated, t.deactivated);
  if t.role_key = 'owner' and (v_role <> 'owner' or v_deact) and
     not exists (select 1 from profiles o where o.org_id = t.org_id and o.role_key = 'owner' and o.is_approved and not o.deactivated and o.id <> t.id) then
    raise exception 'An organisation must keep at least one active owner'; end if;
  if p_set_branch and p_branch is not null and not exists (select 1 from branches where id = p_branch and org_id = c.org_id) then
    raise exception 'Branch not in your organisation'; end if;
  update profiles set role_key = v_role, deactivated = v_deact, is_approved = not v_deact,
         branch_id = case when p_set_branch then p_branch else branch_id end,
         branch_reviewed = case when p_set_branch then true else branch_reviewed end where id = t.id;
  if v_deact then update staff_assignments set revoked_at = now(), revoked_by = c.id where profile_id = t.id and revoked_at is null; end if;
end $$;

create or replace function public.invite_staff(p_email text, p_role text, p_branch uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c profiles; v_id uuid; v_email text := lower(trim(p_email));
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only owners and admins can invite staff' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role not in ('admin', 'branch_manager', 'staff') then raise exception 'Invalid role'; end if;
  if c.role_key <> 'owner' and p_role = 'admin' then raise exception 'Only an owner can invite admins' using errcode = '42501'; end if;
  if p_role in ('branch_manager', 'staff') and p_branch is null then raise exception 'Choose a branch'; end if;
  if p_branch is not null and not exists (select 1 from branches where id = p_branch and org_id = c.org_id and is_active) then raise exception 'Branch not in your organisation'; end if;
  update staff_invitations set revoked_at = now() where org_id = c.org_id and lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into staff_invitations (org_id, email, role_key, branch_id) values (c.org_id, v_email, p_role, p_branch) returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can revoke invitations' using errcode = '42501'; end if;
  update staff_invitations set revoked_at = now() where id = p_id and org_id = public.current_org() and accepted_at is null;
end $$;

-- Called by the signed-in user. Requires a CONFIRMED email equal to the invited address (prevents claiming by typo/squatting).
create or replace function public.claim_invitation() returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_inv staff_invitations; v_name text;
begin
  if v_uid is null then return false; end if;
  select lower(email), coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_email, v_name
    from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return false; end if;
  if exists (select 1 from profiles where id = v_uid and org_id is not null) then return false; end if;
  select * into v_inv from staff_invitations where lower(email) = v_email and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at desc limit 1 for update;
  if not found then return false; end if;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated)
    values (v_uid, v_inv.org_id, v_name, v_inv.role_key, v_inv.branch_id, true, false)
  on conflict (id) do update set org_id = excluded.org_id, role_key = excluded.role_key, branch_id = excluded.branch_id, is_approved = true, deactivated = false;
  update staff_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return true;
end $$;

-- Organisation onboarding: first-run bootstrap (no organisation exists) or an allow-listed platform admin.
create or replace function public.create_organisation(p_name text, p_branch_name text, p_branch_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_br uuid; v_name text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
  if exists (select 1 from profiles where id = v_uid and org_id is not null and is_approved) then raise exception 'You already belong to an organisation'; end if;
  if exists (select 1 from organizations) and not exists (select 1 from platform_admins where user_id = v_uid) then
    raise exception 'Organisation creation is by invitation only' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_branch_name, ''))) < 2 or length(trim(coalesce(p_branch_code, ''))) < 1 then raise exception 'Organisation and branch names are required'; end if;
  insert into organizations (name) values (trim(p_name)) returning id into v_org;
  insert into branches (org_id, code, name) values (v_org, upper(trim(p_branch_code)), trim(p_branch_name)) returning id into v_br;
  select coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_name from auth.users where id = v_uid;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated) values (v_uid, v_org, v_name, 'owner', v_br, true, false)
  on conflict (id) do update set org_id = v_org, role_key = 'owner', branch_id = v_br, is_approved = true, deactivated = false;
  return v_org;
end $$;

-- ── 7. Temporary cross-branch assignments ───────────────────────────────────────
create or replace function public.assign_temp_branch(p_profile uuid, p_branch uuid, p_ends timestamptz, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c profiles; t profiles; v_id uuid;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin', 'branch_manager') then raise exception 'Not authorised to assign staff' using errcode = '42501'; end if;
  select * into t from profiles where id = p_profile and org_id = c.org_id and is_approved and not deactivated;
  if not found then raise exception 'Staff member not found or inactive'; end if;
  if not exists (select 1 from branches where id = p_branch and org_id = c.org_id and is_active) then raise exception 'Branch not in your organisation'; end if;
  if c.role_key = 'branch_manager' and not public.can_access_branch(p_branch) then
    raise exception 'Managers can only bring staff into their own branch' using errcode = '42501'; end if;
  if t.role_key in ('owner', 'admin') then raise exception 'Admins already have access to every branch'; end if;
  insert into staff_assignments (org_id, profile_id, branch_id, ends_at, reason) values (c.org_id, p_profile, p_branch, p_ends, p_reason) returning id into v_id;
  return v_id;
end $$;

create or replace function public.revoke_temp_assignment(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare a staff_assignments;
begin
  select * into a from staff_assignments where id = p_id and org_id = public.current_org() for update;
  if not found then raise exception 'Assignment not found'; end if;
  if not (public.is_admin() or a.created_by = auth.uid() or (public.is_manager() and public.can_access_branch(a.branch_id))) then
    raise exception 'Not authorised' using errcode = '42501'; end if;
  update staff_assignments set revoked_at = now(), revoked_by = auth.uid() where id = p_id and revoked_at is null;
end $$;

-- ── 8. Cross-branch stock transfers (request → approve/dispatch → receive) ──────
create or replace function public.request_transfer(p_from uuid, p_to uuid, p_product uuid, p_qty int, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org(); v_id uuid;
begin
  if v_org is null then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'Choose two different branches'; end if;
  if not (public.can_access_branch(p_from) or public.can_access_branch(p_to)) then raise exception 'Not authorised for these branches' using errcode = '42501'; end if;
  if (select count(*) from branches where id in (p_from, p_to) and org_id = v_org and is_active) <> 2 then raise exception 'Branches must belong to your organisation'; end if;
  if not exists (select 1 from products where id = p_product and org_id = v_org) then raise exception 'Product not found'; end if;
  insert into branch_transfers (org_id, from_branch, to_branch, product_id, qty, note) values (v_org, p_from, p_to, p_product, p_qty, p_note) returning id into v_id;
  return v_id;
end $$;

create or replace function public.approve_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status <> 'requested' then raise exception 'Transfer is not awaiting approval'; end if;
  if not (public.is_manager() and public.can_access_branch(t.from_branch)) then raise exception 'Only a manager of the sending branch can approve' using errcode = '42501'; end if;
  if t.requested_by = auth.uid() and not public.is_admin() then raise exception 'You cannot approve your own request' using errcode = '42501'; end if;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, t.product_id, -t.qty, 'transfer_out', 'Transfer ' || t.id);
  update branch_transfers set status = 'in_transit', approved_by = auth.uid(), approved_at = now() where id = t.id;
end $$;

create or replace function public.receive_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status <> 'in_transit' then raise exception 'Transfer is not in transit'; end if;
  if not public.can_access_branch(t.to_branch) then raise exception 'Only the receiving branch can confirm receipt' using errcode = '42501'; end if;
  insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.to_branch, t.product_id, t.qty, 'transfer_in', 'Transfer ' || t.id);
  update branch_transfers set status = 'received', received_by = auth.uid(), received_at = now() where id = t.id;
end $$;

create or replace function public.close_transfer(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare t branch_transfers;
begin
  select * into t from branch_transfers where id = p_id and org_id = public.current_org() for update;
  if not found or t.status not in ('requested', 'in_transit') then raise exception 'Transfer can no longer be cancelled'; end if;
  if t.status = 'requested' then
    if not (t.requested_by = auth.uid() or (public.is_manager() and (public.can_access_branch(t.from_branch) or public.can_access_branch(t.to_branch)))) then raise exception 'Not authorised' using errcode = '42501'; end if;
    update branch_transfers set status = 'rejected' where id = t.id;
  else
    if not (public.is_manager() and public.can_access_branch(t.from_branch)) then raise exception 'Only a manager of the sending branch can cancel a shipment' using errcode = '42501'; end if;
    insert into stock_movements (org_id, branch_id, product_id, delta, reason, note) values (t.org_id, t.from_branch, t.product_id, t.qty, 'transfer_in', 'Transfer cancelled ' || t.id);
    update branch_transfers set status = 'cancelled' where id = t.id;
  end if;
end $$;

grant execute on function public.admin_update_staff, public.invite_staff, public.revoke_invitation, public.claim_invitation, public.create_organisation,
  public.assign_temp_branch, public.revoke_temp_assignment, public.request_transfer, public.approve_transfer, public.receive_transfer, public.close_transfer to authenticated;
revoke execute on function public.admin_update_staff, public.invite_staff, public.revoke_invitation, public.claim_invitation, public.create_organisation,
  public.assign_temp_branch, public.revoke_temp_assignment, public.request_transfer, public.approve_transfer, public.receive_transfer, public.close_transfer from anon, public;

-- ── 9. org_id defaults: the ERP no longer hardcodes an organisation id; RLS + defaults scope every write ──
do $$ declare t text; begin
  foreach t in array array['loyalty_rules', 'loyalty_ledger', 'coupons', 'eye_examinations', 'crm_settings', 'appointments'] loop
    if to_regclass('public.' || t) is not null then execute format('alter table %I alter column org_id set default public.current_org()', t); end if;
  end loop; end $$;
