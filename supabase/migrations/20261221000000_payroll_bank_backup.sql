-- Payroll, bank reconciliation and Google Drive backups.
-- Payroll is owner/admin only (RLS). An employee can read only their own payslip once the run is finalised.

create table public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  basic numeric(12,2) not null check (basic >= 0),
  hra numeric(12,2) not null default 0 check (hra >= 0),
  other_allowance numeric(12,2) not null default 0 check (other_allowance >= 0),
  pf_pct numeric(5,2) not null default 0 check (pf_pct between 0 and 100),
  esi_pct numeric(5,2) not null default 0 check (esi_pct between 0 and 100),
  professional_tax numeric(10,2) not null default 0 check (professional_tax >= 0),
  effective_from date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (org_id, profile_id)
);
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  status text not null default 'draft' check (status in ('draft', 'finalized', 'paid')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (org_id, period)
);
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null,
  days_in_month int not null, paid_days numeric(5,2) not null check (paid_days >= 0),
  basic numeric(12,2) not null, hra numeric(12,2) not null, other_allowance numeric(12,2) not null, gross numeric(12,2) not null,
  pf numeric(12,2) not null default 0, esi numeric(12,2) not null default 0, professional_tax numeric(12,2) not null default 0,
  other_deduction numeric(12,2) not null default 0 check (other_deduction >= 0), net numeric(12,2) not null,
  note text, paid_on date, payment_method text, payment_reference text,
  unique (run_id, profile_id)
);
create index payslips_profile_idx on public.payslips (profile_id);
alter table public.salary_structures enable row level security; alter table public.payroll_runs enable row level security; alter table public.payslips enable row level security;
create policy sal_admin on public.salary_structures for all to authenticated using (org_id = public.current_org() and public.is_admin()) with check (org_id = public.current_org() and public.is_admin());
create policy run_admin on public.payroll_runs for all to authenticated using (org_id = public.current_org() and public.is_admin()) with check (org_id = public.current_org() and public.is_admin());
create policy slip_admin on public.payslips for all to authenticated using (org_id = public.current_org() and public.is_admin()) with check (org_id = public.current_org() and public.is_admin());
create policy slip_own on public.payslips for select to authenticated using (org_id = public.current_org() and profile_id = auth.uid() and exists (select 1 from public.payroll_runs r where r.id = run_id and r.status in ('finalized', 'paid')));
create trigger trg_sal_audit after insert or update or delete on public.salary_structures for each row execute function public.audit_row();
create trigger trg_run_audit after insert or update or delete on public.payroll_runs for each row execute function public.audit_row();
create trigger trg_slip_audit after insert or update or delete on public.payslips for each row execute function public.audit_row();

-- Pure calculation, shared by generate and edit so the two cannot drift. Statutory rates live on the salary structure (configurable per employee).
create or replace function public.payslip_calc(s public.salary_structures, p_days int, p_paid numeric, p_other numeric)
returns table (basic numeric, hra numeric, other_allowance numeric, gross numeric, pf numeric, esi numeric, professional_tax numeric, net numeric)
language sql immutable as $$
  with f as (select least(greatest(p_paid, 0), p_days)::numeric / p_days as k),
  c as (select round(s.basic * k, 2) b, round(s.hra * k, 2) h, round(s.other_allowance * k, 2) o from f)
  select b, h, o, b + h + o, round(b * s.pf_pct / 100, 2), round((b + h + o) * s.esi_pct / 100, 2), s.professional_tax,
         greatest(b + h + o - round(b * s.pf_pct / 100, 2) - round((b + h + o) * s.esi_pct / 100, 2) - s.professional_tax - coalesce(p_other, 0), 0)
  from c $$;

create or replace function public.generate_payroll(p_period date) returns uuid language plpgsql as $$
declare v_run uuid; v_days int; s public.salary_structures; c record;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can run payroll' using errcode = '42501'; end if;
  if extract(day from p_period) <> 1 then raise exception 'Period must be the first day of a month'; end if;
  if p_period > date_trunc('month', current_date)::date then raise exception 'You cannot run payroll for a future month'; end if;
  v_days := extract(day from (p_period + interval '1 month - 1 day'))::int;
  insert into public.payroll_runs (period) values (p_period) returning id into v_run;
  for s in select ss.* from public.salary_structures ss join public.profiles p on p.id = ss.profile_id where p.deactivated is not true and ss.effective_from < (p_period + interval '1 month')::date loop
    select * into c from public.payslip_calc(s, v_days, v_days, 0);
    insert into public.payslips (run_id, profile_id, branch_id, days_in_month, paid_days, basic, hra, other_allowance, gross, pf, esi, professional_tax, net)
    select v_run, s.profile_id, p.branch_id, v_days, v_days, c.basic, c.hra, c.other_allowance, c.gross, c.pf, c.esi, c.professional_tax, c.net from public.profiles p where p.id = s.profile_id;
  end loop;
  if not exists (select 1 from public.payslips where run_id = v_run) then raise exception 'No employees have a salary set up yet'; end if;
  return v_run;
end $$;

create or replace function public.update_payslip(p_id uuid, p_paid_days numeric, p_other_deduction numeric, p_note text) returns void language plpgsql as $$
declare ps public.payslips; s public.salary_structures; c record; r public.payroll_runs;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can edit payslips' using errcode = '42501'; end if;
  select * into ps from public.payslips where id = p_id; if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = ps.run_id; if r.status <> 'draft' then raise exception 'This payroll run is already finalised'; end if;
  if p_paid_days < 0 or p_paid_days > ps.days_in_month then raise exception 'Paid days must be between 0 and %', ps.days_in_month; end if;
  if coalesce(p_other_deduction, 0) < 0 then raise exception 'Deduction cannot be negative'; end if;
  select * into s from public.salary_structures where profile_id = ps.profile_id; if not found then raise exception 'Salary structure missing'; end if;
  select * into c from public.payslip_calc(s, ps.days_in_month, p_paid_days, p_other_deduction);
  update public.payslips set paid_days = p_paid_days, basic = c.basic, hra = c.hra, other_allowance = c.other_allowance, gross = c.gross, pf = c.pf, esi = c.esi,
    professional_tax = c.professional_tax, other_deduction = coalesce(p_other_deduction, 0), net = c.net, note = nullif(trim(p_note), '') where id = p_id;
end $$;

create or replace function public.finalize_payroll(p_run uuid) returns void language plpgsql as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can finalise payroll' using errcode = '42501'; end if;
  update public.payroll_runs set status = 'finalized', finalized_at = now() where id = p_run and status = 'draft';
  if not found then raise exception 'Run not found or already finalised'; end if;
end $$;
create or replace function public.delete_draft_payroll(p_run uuid) returns void language plpgsql as $$
begin
  if not public.is_admin() then raise exception 'Only owners and admins can delete payroll' using errcode = '42501'; end if;
  delete from public.payroll_runs where id = p_run and status = 'draft'; if not found then raise exception 'Only draft runs can be deleted'; end if;
end $$;
create or replace function public.mark_payslip_paid(p_id uuid, p_method text, p_reference text, p_date date) returns void language plpgsql as $$
declare ps public.payslips; r public.payroll_runs;
begin
  if not public.is_admin() then raise exception 'Only owners and admins can record salary payments' using errcode = '42501'; end if;
  select * into ps from public.payslips where id = p_id; if not found then raise exception 'Payslip not found'; end if;
  select * into r from public.payroll_runs where id = ps.run_id; if r.status = 'draft' then raise exception 'Finalise the payroll run before paying'; end if;
  if ps.paid_on is not null then raise exception 'Already paid'; end if;
  update public.payslips set paid_on = coalesce(p_date, current_date), payment_method = coalesce(nullif(trim(p_method), ''), 'bank_transfer'), payment_reference = nullif(trim(p_reference), '') where id = p_id;
  if not exists (select 1 from public.payslips where run_id = ps.run_id and paid_on is null) then update public.payroll_runs set status = 'paid' where id = ps.run_id; end if;
end $$;
grant execute on function public.generate_payroll, public.update_payslip, public.finalize_payroll, public.delete_draft_payroll, public.mark_payslip_paid to authenticated;

-- Bank reconciliation: imported statement lines, matched to payments / expenses.
create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references public.organizations(id) on delete cascade,
  bank_label text not null default 'Bank', txn_date date not null, description text not null default '', reference text not null default '',
  debit numeric(14,2) not null default 0 check (debit >= 0), credit numeric(14,2) not null default 0 check (credit >= 0),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  matched_kind text check (matched_kind in ('payment', 'expense', 'other')), matched_id uuid, note text,
  imported_by uuid default auth.uid(), created_at timestamptz not null default now(),
  check (debit = 0 or credit = 0)
);
create unique index bank_lines_dedupe on public.bank_statement_lines (org_id, bank_label, txn_date, reference, description, debit, credit);
create index bank_lines_status_idx on public.bank_statement_lines (org_id, status, txn_date);
alter table public.bank_statement_lines enable row level security;
create policy bank_mgr on public.bank_statement_lines for all to authenticated using (org_id = public.current_org() and public.is_manager()) with check (org_id = public.current_org() and public.is_manager());
create trigger trg_bank_audit after update or delete on public.bank_statement_lines for each row execute function public.audit_row();

-- Backups: run history (readable by admins) and the Google connection (never readable by any browser role; service role only).
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')), status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  started_at timestamptz not null default now(), finished_at timestamptz, file_name text, drive_file_id text, size_bytes bigint, table_counts jsonb, error text
);
create index backup_runs_org_idx on public.backup_runs (org_id, started_at desc);
alter table public.backup_runs enable row level security;
create policy backup_read on public.backup_runs for select to authenticated using (org_id = public.current_org() and public.is_admin());
create table public.integration_secrets (
  org_id uuid not null references public.organizations(id) on delete cascade, provider text not null, secret jsonb not null, account_label text, connected_at timestamptz not null default now(),
  primary key (org_id, provider)
);
alter table public.integration_secrets enable row level security;  -- deliberately no policies: only the service role can read or write
revoke all on public.integration_secrets from anon, authenticated;
-- Safe, secret-free view of whether Google Drive is connected (for the Settings screen).
create or replace function public.integration_status(p_provider text) returns table (connected boolean, account_label text, connected_at timestamptz)
language sql stable security definer set search_path = public as $$
  select true, s.account_label, s.connected_at from public.integration_secrets s where s.org_id = public.current_org() and s.provider = p_provider and public.is_admin()
  union all select false, null, null where not exists (select 1 from public.integration_secrets s where s.org_id = public.current_org() and s.provider = p_provider) limit 1 $$;
grant execute on function public.integration_status(text) to authenticated;
create or replace function public.disconnect_integration(p_provider text) returns void language plpgsql security definer set search_path = public as $$
begin if not public.is_admin() then raise exception 'Only owners and admins can disconnect integrations' using errcode = '42501'; end if; delete from public.integration_secrets where org_id = public.current_org() and provider = p_provider; end $$;
grant execute on function public.disconnect_integration(text) to authenticated;
-- Tables included in a backup: every public base table with an org_id column, except secrets and the backup log itself.
create or replace function public.backup_tables() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.table_name order by c.table_name), '{}') from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE' and c.table_name not in ('integration_secrets', 'backup_runs') $$;
revoke execute on function public.backup_tables() from public, anon, authenticated;
