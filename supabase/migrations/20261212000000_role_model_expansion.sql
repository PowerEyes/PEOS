-- Role model expansion (plan §5: "role-based employee workspaces").
-- The app already ships ten employee roles (validators, /settings/roles, the
-- per-role widgets on /) but the database still enforced the original four
-- keys, so an owner assigning "accountant" would fail a CHECK and (worse) the
-- middleware route rules would bounce any non-standard key into a redirect
-- loop. This widens the allow-lists additively: every existing key stays
-- valid and owner/admin/branch_manager/staff behaviour is unchanged.
--
-- Specialised roles are staff-tier for routing (branch-bound, no admin
-- routes); what distinguishes them is their default permission grants below.

-- ── 1. profiles may carry any app role key ───────────────────────────────────
alter table profiles drop constraint if exists profiles_role_key_chk;
alter table profiles add constraint profiles_role_key_chk check (role_key in (
  'owner', 'admin', 'branch_manager', 'staff',
  'optometrist', 'sales_executive', 'cashier',
  'inventory_manager', 'lab_technician', 'accountant', 'receptionist'));

-- ── 2. Per-org grants exist for every non-admin role ─────────────────────────
-- owner/admin bypass has_perm() outright, so they never need rows here.
alter table role_permissions drop constraint if exists role_permissions_role_key_check;
alter table role_permissions add constraint role_permissions_role_key_check check (role_key in (
  'branch_manager', 'staff',
  'optometrist', 'sales_executive', 'cashier',
  'inventory_manager', 'lab_technician', 'accountant', 'receptionist'));

-- ── 3. Invitations can carry any non-admin role ──────────────────────────────
alter table staff_invitations drop constraint if exists staff_invitations_role_key_check;
alter table staff_invitations add constraint staff_invitations_role_key_check check (role_key in (
  'admin', 'branch_manager', 'staff',
  'optometrist', 'sales_executive', 'cashier',
  'inventory_manager', 'lab_technician', 'accountant', 'receptionist'));

-- ── 4. Default grants per specialised role ───────────────────────────────────
-- permission_catalog drives seed_org_permissions() for new organisations.
-- crm_manage and discount_override stay branch_manager-only on purpose:
-- CRM routes are manager-tier and discount override is a sensitive right.
update permission_catalog set default_roles = array['branch_manager', 'accountant', 'cashier']
  where key = 'finance_view';
update permission_catalog set default_roles = array['branch_manager', 'accountant']
  where key in ('expenses', 'day_closing', 'reports_view');
update permission_catalog set default_roles = array['branch_manager', 'inventory_manager']
  where key in ('catalogue_edit', 'stock_adjust', 'stock_audit', 'transfers_approve', 'purchases_manage');
update permission_catalog set default_roles = array['branch_manager', 'sales_executive']
  where key = 'web_orders';
update permission_catalog set default_roles = array['branch_manager', 'cashier']
  where key = 'credit_notes.issue';

-- ── 5. Seeding accepts the new keys, then backfills existing organisations ──
create or replace function public.seed_org_permissions(p_org uuid) returns void
language sql security definer set search_path to 'public' as $function$
  insert into role_permissions (org_id, role_key, permission)
  select p_org, r, c.key from permission_catalog c, unnest(c.default_roles) r
  where r in ('branch_manager', 'staff',
              'optometrist', 'sales_executive', 'cashier',
              'inventory_manager', 'lab_technician', 'accountant', 'receptionist')
  on conflict do nothing $function$;
select public.seed_org_permissions(id) from organizations;

-- ── 6. Owners/admins may grant any non-admin role ────────────────────────────
create or replace function public.set_role_permission(p_role text, p_permission text, p_allowed boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can change permissions' using errcode='42501'; end if;
  if p_role not in ('branch_manager', 'staff',
                    'optometrist', 'sales_executive', 'cashier',
                    'inventory_manager', 'lab_technician', 'accountant', 'receptionist')
     or p_allowed is null or not exists(select 1 from public.permission_catalog where key=p_permission) then
    raise exception 'Invalid role permission';
  end if;
  insert into public.role_permissions(org_id, role_key, permission, allowed)
  values(public.current_org(), p_role, p_permission, p_allowed)
  on conflict(org_id, role_key, permission) do update
    set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();
end $function$;

-- ── 7. Staff lifecycle RPCs accept the full role set ─────────────────────────
create or replace function public.admin_update_staff(p_id uuid, p_role text default null, p_branch uuid default null,
    p_set_branch boolean default false, p_deactivated boolean default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare c profiles; t profiles; v_role text; v_deact boolean;
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only owners and admins can manage staff' using errcode = '42501'; end if;
  select * into t from profiles where id = p_id and org_id = c.org_id for update;
  if not found then raise exception 'Staff member not found'; end if;
  if t.id = c.id and (p_role is not null or p_deactivated is true) then raise exception 'You cannot change your own role or deactivate yourself'; end if;
  if c.role_key <> 'owner' and (t.role_key in ('owner', 'admin') or p_role in ('owner', 'admin')) then
    raise exception 'Only an owner can manage or grant admin/owner access' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('owner', 'admin', 'branch_manager', 'staff',
      'optometrist', 'sales_executive', 'cashier',
      'inventory_manager', 'lab_technician', 'accountant', 'receptionist') then
    raise exception 'Invalid role'; end if;
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
language plpgsql security definer set search_path to 'public' as $$
declare c profiles; v_id uuid; v_email text := lower(trim(p_email));
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then raise exception 'Only owners and admins can invite staff' using errcode = '42501'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role not in ('admin', 'branch_manager', 'staff',
                    'optometrist', 'sales_executive', 'cashier',
                    'inventory_manager', 'lab_technician', 'accountant', 'receptionist') then
    raise exception 'Invalid role'; end if;
  if c.role_key <> 'owner' and p_role = 'admin' then raise exception 'Only an owner can invite admins' using errcode = '42501'; end if;
  -- Every non-admin role is branch-bound: the invite must say where they work.
  if p_role not in ('owner', 'admin') and p_branch is null then raise exception 'Choose a branch'; end if;
  if p_branch is not null and not exists (select 1 from branches where id = p_branch and org_id = c.org_id and is_active) then raise exception 'Branch not in your organisation'; end if;
  update staff_invitations set revoked_at = now() where org_id = c.org_id and lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into staff_invitations (org_id, email, role_key, branch_id) values (c.org_id, v_email, p_role, p_branch) returning id into v_id;
  return v_id;
end $$;
