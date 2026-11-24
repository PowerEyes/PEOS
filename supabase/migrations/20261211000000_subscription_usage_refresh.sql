-- Usage snapshots (plan §7 limit keys, §6 /subscription/usage).
--
-- org_usage() computes live counts on demand; subscription_usage keeps a
-- per-period history so the company usage page and the platform admin view can
-- show "this month so far" instead of a number that silently changes.
-- The unique key (org_id, metric, period_start) makes refresh idempotent.

create or replace function public.refresh_subscription_usage(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period timestamptz := date_trunc('month', now());
  v_rows integer := 0;
  r record;
begin
  -- Callers may only refresh their own organisation. Service-role callers
  -- (cron, platform admin client) have no auth.uid() and pass this guard.
  if auth.uid() is not null
     and not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.org_id = p_org)
     and not exists (select 1 from public.platform_users pu where pu.user_id = auth.uid() and pu.is_active) then
    raise exception 'refresh_subscription_usage: organisation mismatch';
  end if;

  for r in select metric, value from public.org_usage(p_org) loop
    insert into public.subscription_usage (org_id, metric, value, period_start, period_end, updated_at)
    values (p_org, r.metric, r.value, v_period, v_period + interval '1 month', now())
    on conflict (org_id, metric, period_start)
    do update set value = excluded.value, updated_at = now();
    v_rows := v_rows + 1;
  end loop;
  return v_rows;
end $$;

-- Scheduler variant: one pass over every organisation. Service-role only —
-- tenants must not be able to trigger company-wide work from a session.
create or replace function public.refresh_subscription_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  o record;
begin
  -- The scheduler carries no tenant identity. Clear any residual JWT claims
  -- (set_config(..., true) is transaction-scoped, so a session can outlive the
  -- reset role that follows it) so the per-org guard sees a cron/service caller
  -- instead of a stale authenticated member of some other company.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  for o in select id from public.organizations loop
    v_total := v_total + public.refresh_subscription_usage(o.id);
  end loop;
  return v_total;
end $$;

revoke execute on function public.refresh_subscription_usage() from public, anon, authenticated;
grant execute on function public.refresh_subscription_usage() to service_role;
-- The per-org variant is self-guarding (own org or platform admin only).
revoke execute on function public.refresh_subscription_usage(uuid) from public, anon;
grant execute on function public.refresh_subscription_usage(uuid) to authenticated, service_role;

-- Daily snapshot, installed only when pg_cron is present (same note as
-- 20261206000000_subscription_lifecycle.sql). The `/subscription/usage` page
-- refreshes the caller's own row on demand, so local/dev without pg_cron still
-- shows fresh numbers.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'subscription-usage') then
      perform cron.unschedule('subscription-usage');
    end if;
    perform cron.schedule('subscription-usage', '5 0 * * *',
                          $$select public.refresh_subscription_usage()$$);
  end if;
end $do$;
