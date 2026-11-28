-- The production grant hardening only revoked anon from SECURITY DEFINER
-- functions. Payroll's calculation/edit RPCs are invoker functions, so close
-- the remaining anon entry points while keeping authenticated access intact.
revoke execute on function public.generate_payroll(date) from public, anon;
revoke execute on function public.finalize_payroll(uuid) from public, anon;
revoke execute on function public.delete_draft_payroll(uuid) from public, anon;
revoke execute on function public.update_payslip(uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.mark_payslip_paid(uuid, text, text, date) from public, anon;
revoke execute on function public.payslip_calc(public.salary_structures, integer, numeric, numeric) from public, anon;
revoke execute on function public.salary_revision_trg() from public, anon;

grant execute on function public.generate_payroll(date) to authenticated, service_role;
grant execute on function public.finalize_payroll(uuid) to authenticated, service_role;
grant execute on function public.delete_draft_payroll(uuid) to authenticated, service_role;
grant execute on function public.update_payslip(uuid, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.mark_payslip_paid(uuid, text, text, date) to authenticated, service_role;
grant execute on function public.payslip_calc(public.salary_structures, integer, numeric, numeric) to authenticated, service_role;
grant execute on function public.salary_revision_trg() to authenticated, service_role;
