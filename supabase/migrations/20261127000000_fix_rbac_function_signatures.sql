-- Repair RBAC function signatures on databases where the earlier migrations
-- were partially applied or the invite_staff overloads both exist.

-- Drop both overloads first so future name-only GRANT/REVOKE statements cannot
-- be ambiguous. The canonical ERP API is the single-branch variant.
drop function if exists public.invite_staff(text, text, uuid[]);
drop function if exists public.invite_staff(text, text, uuid);

create function public.invite_staff(p_email text, p_role text, p_branch uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c profiles;
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  select * into c from profiles where id = auth.uid() and is_approved and not deactivated;
  if not found or c.role_key not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite staff' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email'; end if;
  if p_role not in ('admin', 'branch_manager', 'staff') then raise exception 'Invalid role'; end if;
  if c.role_key <> 'owner' and p_role = 'admin' then
    raise exception 'Only an owner can invite admins' using errcode = '42501';
  end if;
  if p_role in ('branch_manager', 'staff') and p_branch is null then raise exception 'Choose a branch'; end if;
  if p_branch is not null and not exists (
    select 1 from branches where id = p_branch and org_id = c.org_id and is_active
  ) then raise exception 'Branch not in your organisation'; end if;

  update staff_invitations set revoked_at = now()
  where org_id = c.org_id and lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into staff_invitations (org_id, email, role_key, branch_id)
  values (c.org_id, v_email, p_role, p_branch)
  returning id into v_id;
  return v_id;
end $$;

-- Existing deployments may have p_perm while others have p_permission. Drop
-- the exact signature first because PostgreSQL cannot rename input parameters
-- through CREATE OR REPLACE FUNCTION.
drop function if exists public.set_role_permission(text, text, boolean);
create function public.set_role_permission(p_role text, p_permission text, p_allowed boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only owners and admins can change permissions' using errcode = '42501';
  end if;
  insert into role_permissions (org_id, role_key, permission, allowed)
  values (public.current_org(), p_role, p_permission, p_allowed)
  on conflict (org_id, role_key, permission)
  do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();
end $$;

revoke execute on function public.invite_staff(text, text, uuid) from public, anon;
grant execute on function public.invite_staff(text, text, uuid) to authenticated;
revoke execute on function public.set_role_permission(text, text, boolean) from public, anon;
grant execute on function public.set_role_permission(text, text, boolean) to authenticated;
