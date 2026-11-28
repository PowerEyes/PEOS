-- A draft paid-days edit must recalculate using the salary that was effective
-- for the payroll month, not a later revision stored in the current-salary cache.
create or replace function public.update_payslip(
  p_id uuid, p_paid_days numeric, p_other_deduction numeric, p_note text)
returns void language plpgsql as $$
declare
  ps public.payslips; r public.payroll_runs; v_s record; c record;
  v_end date;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can edit payslips' using errcode = '42501'; end if;
  select * into ps from public.payslips where id = p_id;
  if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = ps.run_id;
  if r.status <> 'draft' then raise exception 'This payroll run is already finalised'; end if;
  if p_paid_days < 0 or p_paid_days > ps.days_in_month then
    raise exception 'Paid days must be between 0 and %', ps.days_in_month;
  end if;
  if coalesce(p_other_deduction, 0) < 0 then raise exception 'Deduction cannot be negative'; end if;

  v_end := (r.period + interval '1 month - 1 day')::date;
  select s.basic base_basic, s.hra base_hra, s.other_allowance base_other,
         s.pf_pct base_pf, s.esi_pct base_esi, s.professional_tax base_pt,
         coalesce(sr.basic, s.basic) basic,
         coalesce(sr.hra, s.hra) hra,
         coalesce(sr.other_allowance, s.other_allowance) other_allowance,
         coalesce(sr.pf_pct, s.pf_pct) pf_pct,
         coalesce(sr.esi_pct, s.esi_pct) esi_pct,
         coalesce(sr.professional_tax, s.professional_tax) professional_tax
    into v_s
    from public.salary_structures s
    left join lateral (
      select sr.* from public.salary_revisions sr
      where sr.org_id = ps.org_id and sr.profile_id = ps.profile_id
        and sr.effective_from <= v_end
      order by sr.effective_from desc, sr.created_at desc limit 1
    ) sr on true
    where s.profile_id = ps.profile_id;
  if not found then raise exception 'Salary structure missing'; end if;

  select * into c from public.payslip_calc_v2(
    v_s.basic, v_s.hra, v_s.other_allowance, v_s.pf_pct, v_s.esi_pct,
    v_s.professional_tax, ps.days_in_month, p_paid_days, p_other_deduction);

  update public.payslips set
    paid_days = p_paid_days, basic = c.basic, hra = c.hra,
    other_allowance = c.other_allowance, gross = c.gross,
    pf = c.pf, esi = c.esi, professional_tax = c.professional_tax,
    other_deduction = coalesce(p_other_deduction, 0), net = c.net,
    note = nullif(trim(p_note), '')
  where id = p_id;
end $$;

revoke execute on function public.update_payslip(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.update_payslip(uuid, numeric, numeric, text) to authenticated, service_role;
