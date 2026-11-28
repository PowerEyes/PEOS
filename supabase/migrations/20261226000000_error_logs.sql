-- Application error log (client + server). Written only by server routes (service role); admins read their own org.
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  app text not null check (app in ('erp','web')),
  level text not null default 'error' check (level in ('error','warning')),
  message text not null,
  stack text,
  digest text,
  path text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists error_logs_org_created on public.error_logs (org_id, created_at desc);
alter table public.error_logs enable row level security;
drop policy if exists error_logs_admin_read on public.error_logs;
create policy error_logs_admin_read on public.error_logs for select to authenticated using (org_id = public.current_org() and public.is_admin());
revoke all on public.error_logs from anon, authenticated; grant select on public.error_logs to authenticated;

-- Keep 60 days.
create or replace function public.prune_error_logs() returns void language sql security definer set search_path = public as $$
  delete from public.error_logs where created_at < now() - interval '60 days' $$;
revoke execute on function public.prune_error_logs() from public, anon, authenticated;
grant execute on function public.prune_error_logs() to service_role;
