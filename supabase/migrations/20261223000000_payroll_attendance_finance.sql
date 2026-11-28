-- Payroll completion (additive, safe to re-run on a fresh database):
--   * attendance / leave master data and approval workflow
--   * salary revision history, used by payroll generation
--   * paid days generated from attendance (manual override still allowed in a draft)
--   * salary payment posts an expense row; the existing cashbook trigger posts the ledger
-- No previously applied migration is edited.

-- ── 1. Leave types / holidays ────────────────────────────────────────────────
create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_paid boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);
alter table public.leave_types enable row level security;
create policy leave_types_read on public.leave_types for select to authenticated
  using (org_id = public.current_org());
create policy leave_types_write on public.leave_types for all to authenticated
  using (org_id = public.current_org() and public.is_admin())
  with check (org_id = public.current_org() and public.is_admin());
create trigger trg_leave_types_audit after insert or update or delete on public.leave_types
  for each row execute function public.audit_row();

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  name text not null,
  holiday_date date not null,
  is_weekly_off boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, holiday_date)
);
alter table public.holidays enable row level security;
create policy holidays_read on public.holidays for select to authenticated
  using (org_id = public.current_org());
create policy holidays_write on public.holidays for all to authenticated
  using (org_id = public.current_org() and public.is_admin())
  with check (org_id = public.current_org() and public.is_admin());
create trigger trg_holidays_audit after insert or update or delete on public.holidays
  for each row execute function public.audit_row();

insert into public.leave_types (org_id, code, name, is_paid)
select o.id, x.code, x.name, x.is_paid
from public.organizations o
cross join (values ('CL','Casual Leave',true),('SL','Sick Leave',true),('EL','Earned Leave',true),('LWP','Leave Without Pay',false)) as x(code,name,is_paid)
on conflict (org_id, code) do nothing;

-- ── 2. Attendance and leave requests ────────────────────────────────────────
create table public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  status text not null default 'present' check (status in ('present','half_day','absent','leave','weekly_off','holiday')),
  leave_type_id uuid references public.leave_types(id) on delete set null,
  paid_days numeric(3,1) not null default 1 check (paid_days >= 0 and paid_days <= 1),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (org_id, profile_id, work_date)
);
create index attendance_days_month_idx on public.attendance_days (org_id, work_date desc);
alter table public.attendance_days enable row level security;
create policy attendance_read on public.attendance_days for select to authenticated
  using (org_id = public.current_org() and (public.is_admin() or profile_id = auth.uid()));
create policy attendance_write on public.attendance_days for all to authenticated
  using (org_id = public.current_org() and public.is_admin())
  with check (org_id = public.current_org() and public.is_admin());
create trigger trg_attendance_audit after insert or update or delete on public.attendance_days
  for each row execute function public.audit_row();

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  leave_type_id uuid not null references public.leave_types(id),
  from_date date not null,
  to_date date not null,
  days numeric(5,1) not null check (days > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index leave_requests_month_idx on public.leave_requests (org_id, from_date desc);
alter table public.leave_requests enable row level security;
create policy leave_req_read on public.leave_requests for select to authenticated
  using (org_id = public.current_org() and (public.is_admin() or profile_id = auth.uid()));
create policy leave_req_insert on public.leave_requests for insert to authenticated
  with check (org_id = public.current_org() and profile_id = auth.uid());
create policy leave_req_update on public.leave_requests for update to authenticated
  using (org_id = public.current_org() and (public.is_admin() or (profile_id = auth.uid() and status = 'pending')))
  with check (org_id = public.current_org());
create trigger trg_leave_req_audit after insert or update or delete on public.leave_requests
  for each row execute function public.audit_row();

-- ── 3. Salary revision history ──────────────────────────────────────────────
-- salary_structures stays the "current salary" cache used by the existing UI.
-- Every save is archived here so a run for an earlier month uses that month's salary.
create table public.salary_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  basic numeric(12,2) not null,
  hra numeric(12,2) not null default 0,
  other_allowance numeric(12,2) not null default 0,
  pf_pct numeric(5,2) not null default 0,
  esi_pct numeric(5,2) not null default 0,
  professional_tax numeric(10,2) not null default 0,
  effective_from date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index salary_revisions_lookup on public.salary_revisions (org_id, profile_id, effective_from desc, created_at desc);
alter table public.salary_revisions enable row level security;
create policy salary_rev_admin on public.salary_revisions for all to authenticated
  using (org_id = public.current_org() and public.is_admin())
  with check (org_id = public.current_org() and public.is_admin());
create trigger trg_salary_rev_audit after insert or update or delete on public.salary_revisions
  for each row execute function public.audit_row();

create or replace function public.salary_revision_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.salary_revisions
    (org_id, profile_id, basic, hra, other_allowance, pf_pct, esi_pct, professional_tax, effective_from)
  values
    (new.org_id, new.profile_id, new.basic, new.hra, new.other_allowance, new.pf_pct, new.esi_pct, new.professional_tax, new.effective_from);
  return new;
end $$;
drop trigger if exists trg_salary_revision on public.salary_structures;
create trigger trg_salary_revision after insert or update on public.salary_structures
  for each row execute function public.salary_revision_trg();

-- ── 4. Paid days from attendance ────────────────────────────────────────────
-- If no attendance was marked for an employee in a month, full salary is assumed
-- so existing setup keeps working. Once attendance exists, paid days = sum of
-- attendance paid_days for that month (1 = full day, 0.5 = half day, 0 = unpaid).
create or replace function public.payroll_paid_days(p_profile uuid, p_period date)
returns numeric language sql stable security definer set search_path = public as $$
  with bounds as (
    select p_period as from_date, (p_period + interval '1 month - 1 day')::date as to_date,
           extract(day from (p_period + interval '1 month - 1 day'))::numeric as full_days
  )
  select case
    when exists (select 1 from public.attendance_days a
                 where a.org_id = public.current_org() and a.profile_id = p_profile
                   and a.work_date between b.from_date and b.to_date)
      then coalesce((select sum(a.paid_days) from public.attendance_days a
                     where a.org_id = public.current_org() and a.profile_id = p_profile
                       and a.work_date between b.from_date and b.to_date), 0)
    else b.full_days
  end
  from bounds b
$$;

-- Component-based calculation, shared by generation and draft edits.
create or replace function public.payslip_calc_v2(
  p_basic numeric, p_hra numeric, p_other numeric, p_pf_pct numeric,
  p_esi_pct numeric, p_pt numeric, p_days int, p_paid numeric, p_other_ded numeric)
returns table (basic numeric, hra numeric, other_allowance numeric, gross numeric,
               pf numeric, esi numeric, professional_tax numeric, net numeric)
language sql immutable as $$
  with f as (
    select least(greatest(coalesce(p_paid, 0), 0), p_days)::numeric / nullif(p_days, 0) as k
  ), c as (
    select round(coalesce(p_basic,0) * k, 2) b,
           round(coalesce(p_hra,0) * k, 2) h,
           round(coalesce(p_other,0) * k, 2) o
    from f
  )
  select b, h, o, b + h + o,
         round(b * coalesce(p_pf_pct,0) / 100, 2),
         round((b + h + o) * coalesce(p_esi_pct,0) / 100, 2),
         coalesce(p_pt,0),
         greatest(b + h + o
           - round(b * coalesce(p_pf_pct,0) / 100, 2)
           - round((b + h + o) * coalesce(p_esi_pct,0) / 100, 2)
           - coalesce(p_pt,0) - coalesce(p_other_ded,0), 0)
  from c
$$;

-- ── 5. Generate payroll: revision-aware, attendance-fed, approved staff only ─
create or replace function public.generate_payroll(p_period date) returns uuid
language plpgsql as $$
declare
  v_run uuid; v_days int; v_s record; v_paid numeric; v_c record;
  v_org uuid := public.current_org();
begin
  if not public.is_admin() then raise exception 'Only owners and admins can run payroll' using errcode = '42501'; end if;
  if extract(day from p_period) <> 1 then raise exception 'Period must be the first day of a month'; end if;
  if p_period > date_trunc('month', current_date)::date then raise exception 'You cannot run payroll for a future month'; end if;
  if exists (select 1 from public.payroll_runs where org_id = v_org and period = p_period) then
    raise exception 'A payroll run already exists for this month';
  end if;
  v_days := extract(day from (p_period + interval '1 month - 1 day'))::int;
  insert into public.payroll_runs (period) values (p_period) returning id into v_run;

  for v_s in
    select ss.profile_id, ss.basic, ss.hra, ss.other_allowance, ss.pf_pct, ss.esi_pct, ss.professional_tax,
           p.branch_id,
           coalesce(r.basic, ss.basic) basic_eff, coalesce(r.hra, ss.hra) hra_eff,
           coalesce(r.other_allowance, ss.other_allowance) other_eff,
           coalesce(r.pf_pct, ss.pf_pct) pf_eff, coalesce(r.esi_pct, ss.esi_pct) esi_eff,
           coalesce(r.professional_tax, ss.professional_tax) pt_eff
    from public.salary_structures ss
    join public.profiles p on p.id = ss.profile_id and p.org_id = v_org
      and p.is_approved and coalesce(p.deactivated, false) = false
    left join lateral (
      select sr.* from public.salary_revisions sr
      where sr.org_id = v_org and sr.profile_id = ss.profile_id
        and sr.effective_from <= (p_period + interval '1 month - 1 day')::date
      order by sr.effective_from desc, sr.created_at desc limit 1
    ) r on true
  loop
    v_paid := public.payroll_paid_days(v_s.profile_id, p_period);
    select * into v_c from public.payslip_calc_v2(
      v_s.basic_eff, v_s.hra_eff, v_s.other_eff, v_s.pf_eff, v_s.esi_eff, v_s.pt_eff,
      v_days, v_paid, 0);
    insert into public.payslips
      (run_id, profile_id, branch_id, days_in_month, paid_days,
       basic, hra, other_allowance, gross, pf, esi, professional_tax, net)
    values
      (v_run, v_s.profile_id, v_s.branch_id, v_days, v_paid,
       v_c.basic, v_c.hra, v_c.other_allowance, v_c.gross, v_c.pf, v_c.esi, v_c.professional_tax, v_c.net);
  end loop;
  if not exists (select 1 from public.payslips where run_id = v_run) then
    raise exception 'No approved employees have a salary set up yet';
  end if;
  return v_run;
end $$;

create or replace function public.update_payslip(p_id uuid, p_paid_days numeric, p_other_deduction numeric, p_note text)
returns void language plpgsql as $$
declare ps public.payslips; s public.salary_structures; c record; r public.payroll_runs;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can edit payslips' using errcode = '42501'; end if;
  select * into ps from public.payslips where id = p_id; if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = ps.run_id; if r.status <> 'draft' then raise exception 'This payroll run is already finalised'; end if;
  if p_paid_days < 0 or p_paid_days > ps.days_in_month then raise exception 'Paid days must be between 0 and %', ps.days_in_month; end if;
  if coalesce(p_other_deduction, 0) < 0 then raise exception 'Deduction cannot be negative'; end if;
  select * into s from public.salary_structures where profile_id = ps.profile_id; if not found then raise exception 'Salary structure missing'; end if;
  select * into c from public.payslip_calc_v2(s.basic, s.hra, s.other_allowance, s.pf_pct, s.esi_pct, s.professional_tax, ps.days_in_month, p_paid_days, p_other_deduction);
  update public.payslips set paid_days = p_paid_days, basic = c.basic, hra = c.hra, other_allowance = c.other_allowance,
    gross = c.gross, pf = c.pf, esi = c.esi, professional_tax = c.professional_tax,
    other_deduction = coalesce(p_other_deduction, 0), net = c.net,
    note = nullif(trim(p_note), '') where id = p_id;
end $$;

-- ── 6. Mark paid: expense + cashbook (trigger posts the ledger) ─────────────
create or replace function public.mark_payslip_paid(p_id uuid, p_method text, p_reference text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  ps public.payslips; r public.payroll_runs;
  v_emp text; v_branch uuid; v_method text; v_ref text; v_period text;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can record salary payments' using errcode = '42501'; end if;
  select * into ps from public.payslips where id = p_id and org_id = public.current_org();
  if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = ps.run_id;
  if r.status = 'draft' then raise exception 'Finalise the payroll run before paying'; end if;
  if ps.paid_on is not null then raise exception 'Already paid'; end if;

  select p.full_name, p.branch_id into v_emp, v_branch from public.profiles p where p.id = ps.profile_id;
  v_branch := coalesce(v_branch, ps.branch_id,
    (select id from public.branches where org_id = ps.org_id and is_active
     order by is_default_pickup desc, name limit 1));
  if v_branch is null then raise exception 'No active branch available for the salary expense'; end if;

  v_method := case
    when lower(coalesce(p_method,'')) = 'cash' then 'cash'
    when lower(coalesce(p_method,'')) like 'upi%' then 'upi'
    when lower(coalesce(p_method,'')) like 'card%' then 'card'
    else 'bank'
  end;
  v_ref := nullif(trim(coalesce(p_reference,'')), '');
  v_period := trim(to_char(r.period, 'Month YYYY'));

  -- Idempotent: a retry can never create a second expense / cashbook entry.
  if not exists (select 1 from public.expenses e
                 where e.org_id = ps.org_id and e.category = 'Salary' and e.reference = p_id::text) then
    insert into public.expenses
      (org_id, branch_id, category, description, amount, expense_date, payment_method,
       reference, approved_by, created_by)
    values
      (ps.org_id, v_branch, 'Salary', 'Salary ' || v_period || ' - ' || coalesce(v_emp, 'Employee'),
       ps.net, coalesce(p_date, current_date), v_method, p_id::text, auth.uid(), auth.uid());
  end if;

  update public.payslips
     set paid_on = coalesce(p_date, current_date),
         payment_method = coalesce(nullif(trim(p_method), ''), 'bank'),
         payment_reference = v_ref
   where id = p_id;
  if not exists (select 1 from public.payslips where run_id = ps.run_id and paid_on is null) then
    update public.payroll_runs set status = 'paid' where id = ps.run_id;
  end if;
end $$;

-- ── 7. Attendance / leave RPCs ──────────────────────────────────────────────
create or replace function public.save_attendance_day(
  p_profile uuid, p_date date, p_status text, p_leave_type uuid,
  p_paid_days numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org(); v_branch uuid; v_paid numeric;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can mark attendance' using errcode = '42501'; end if;
  if p_status not in ('present','half_day','absent','leave','weekly_off','holiday') then
    raise exception 'Unknown attendance status'; end if;
  select branch_id into v_branch from public.profiles where id = p_profile and org_id = v_org;
  if not found then raise exception 'Employee not found'; end if;
  v_paid := case p_status
    when 'present' then 1 when 'half_day' then 0.5 when 'absent' then 0
    when 'weekly_off' then 0 when 'holiday' then 1
    else coalesce(p_paid_days, 0) end;
  insert into public.attendance_days
    (org_id, branch_id, profile_id, work_date, status, leave_type_id, paid_days, note, created_by)
  values
    (v_org, v_branch, p_profile, p_date, p_status, p_leave_type,
     least(greatest(v_paid, 0), 1), nullif(trim(coalesce(p_note,'')), ''), auth.uid())
  on conflict (org_id, profile_id, work_date) do update
    set branch_id = excluded.branch_id, status = excluded.status,
        leave_type_id = excluded.leave_type_id, paid_days = excluded.paid_days,
        note = excluded.note, created_by = excluded.created_by;
end $$;

create or replace function public.apply_leave(
  p_leave_type uuid, p_from date, p_to date, p_days numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org(); v_id uuid; v_branch uuid;
begin
  if v_org is null then raise exception 'Only approved staff can apply for leave'; end if;
  if p_to < p_from then raise exception 'End date must be on or after the start date'; end if;
  if coalesce(p_days, 0) <= 0 then raise exception 'Enter the number of leave days'; end if;
  if not exists (select 1 from public.leave_types where id = p_leave_type and org_id = v_org and is_active) then
    raise exception 'Choose a valid leave type'; end if;
  select branch_id into v_branch from public.profiles where id = auth.uid() and org_id = v_org;
  insert into public.leave_requests
    (org_id, profile_id, branch_id, leave_type_id, from_date, to_date, days, reason, requested_by)
  values
    (v_org, auth.uid(), v_branch, p_leave_type, p_from, p_to, p_days,
     nullif(trim(coalesce(p_reason,'')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.approve_leave(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare l public.leave_requests; lt public.leave_types; d date; v_paid numeric;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can approve leave' using errcode = '42501'; end if;
  select * into l from public.leave_requests where id = p_id and org_id = public.current_org();
  if not found then raise exception 'Leave request not found'; end if;
  if l.status <> 'pending' then raise exception 'This request has already been decided'; end if;
  select * into lt from public.leave_types where id = l.leave_type_id;
  update public.leave_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(), approved_at = now()
   where id = p_id;
  if p_approve then
    v_paid := case when lt.is_paid then 1 else 0 end;
    for d in select generate_series(l.from_date, l.to_date, interval '1 day')::date loop
      if extract(isodow from d) < 6
         and not exists (select 1 from public.holidays h where h.org_id = l.org_id and h.holiday_date = d) then
        insert into public.attendance_days
          (org_id, branch_id, profile_id, work_date, status, leave_type_id, paid_days, created_by)
        values
          (l.org_id, l.branch_id, l.profile_id, d, 'leave', l.leave_type_id, v_paid, auth.uid())
        on conflict (org_id, profile_id, work_date) do nothing;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.save_leave_type(
  p_id uuid, p_code text, p_name text, p_is_paid boolean, p_is_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org();
begin
  if not public.is_admin() then raise exception 'Only owners and admins can configure leave types' using errcode = '42501'; end if;
  if nullif(trim(coalesce(p_code,'')), '') is null or nullif(trim(coalesce(p_name,'')), '') is null then
    raise exception 'Enter a code and a name'; end if;
  insert into public.leave_types (id, org_id, code, name, is_paid, is_active)
  values (coalesce(p_id, gen_random_uuid()), v_org, upper(trim(p_code)), trim(p_name), coalesce(p_is_paid,true), coalesce(p_is_active,true))
  on conflict (id) do update set code = excluded.code, name = excluded.name,
    is_paid = excluded.is_paid, is_active = excluded.is_active;
end $$;

create or replace function public.save_holiday(p_id uuid, p_name text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org();
begin
  if not public.is_admin() then raise exception 'Only owners and admins can configure holidays' using errcode = '42501'; end if;
  if nullif(trim(coalesce(p_name,'')), '') is null or p_date is null then raise exception 'Enter a name and a date'; end if;
  insert into public.holidays (id, org_id, name, holiday_date)
  values (coalesce(p_id, gen_random_uuid()), v_org, trim(p_name), p_date)
  on conflict (org_id, holiday_date) do update set name = excluded.name;
end $$;

-- ── 8. Grants (no anon access; explicit authenticated/service role) ─────────
revoke execute on function public.payslip_calc_v2(numeric,numeric,numeric,numeric,numeric,numeric,int,numeric,numeric) from public, anon;
revoke execute on function public.payroll_paid_days(uuid,date) from public, anon;
revoke execute on function public.save_attendance_day(uuid,date,text,uuid,numeric,text) from public, anon;
revoke execute on function public.apply_leave(uuid,date,date,numeric,text) from public, anon;
revoke execute on function public.approve_leave(uuid,boolean) from public, anon;
revoke execute on function public.save_leave_type(uuid,text,text,boolean,boolean) from public, anon;
revoke execute on function public.save_holiday(uuid,text,date) from public, anon;
grant execute on function public.payslip_calc_v2(numeric,numeric,numeric,numeric,numeric,numeric,int,numeric,numeric) to authenticated, service_role;
grant execute on function public.payroll_paid_days(uuid,date) to authenticated, service_role;
grant execute on function public.save_attendance_day(uuid,date,text,uuid,numeric,text) to authenticated, service_role;
grant execute on function public.apply_leave(uuid,date,date,numeric,text) to authenticated, service_role;
grant execute on function public.approve_leave(uuid,boolean) to authenticated, service_role;
grant execute on function public.save_leave_type(uuid,text,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.save_holiday(uuid,text,date) to authenticated, service_role;
