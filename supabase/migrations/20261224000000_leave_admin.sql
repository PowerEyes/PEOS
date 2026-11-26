-- Admins can record leave on behalf of an employee; self-service still works.
drop policy if exists leave_req_insert on public.leave_requests;
create policy leave_req_insert on public.leave_requests for insert to authenticated
  with check (org_id = public.current_org() and (profile_id = auth.uid() or public.is_admin()));

create or replace function public.create_leave_for(
  p_profile uuid, p_leave_type uuid, p_from date, p_to date,
  p_days numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org(); v_id uuid; v_branch uuid;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can record leave for staff' using errcode = '42501'; end if;
  if p_to < p_from then raise exception 'End date must be on or after the start date'; end if;
  if coalesce(p_days, 0) <= 0 then raise exception 'Enter the number of leave days'; end if;
  if not exists (select 1 from public.leave_types where id = p_leave_type and org_id = v_org and is_active) then
    raise exception 'Choose a valid leave type'; end if;
  select branch_id into v_branch from public.profiles where id = p_profile and org_id = v_org;
  if not found then raise exception 'Employee not found'; end if;
  insert into public.leave_requests
    (org_id, profile_id, branch_id, leave_type_id, from_date, to_date, days, reason, requested_by)
  values
    (v_org, p_profile, v_branch, p_leave_type, p_from, p_to, p_days,
     nullif(trim(coalesce(p_reason,'')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_leave_for(uuid,uuid,date,date,numeric,text) from public, anon;
grant execute on function public.create_leave_for(uuid,uuid,date,date,numeric,text) to authenticated, service_role;
