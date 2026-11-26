-- 20261206000000_subscription_lifecycle.sql
-- Trial / renewal expiry (plan phase 3): one SQL function owns every lifecycle
-- transition so the cron, the edge function and a platform admin all behave
-- identically — and so the behaviour is testable straight from the DB test suite.
--
-- Nothing here ever deletes tenant data. An expired subscription only flips status:
-- reads, exports, billing and support stay open (plan non-goal: no data deletion).

create or replace function public.run_subscription_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_trial_expired  int := 0;
  v_past_due      int := 0;
  v_grace_expired int := 0;
  v_cancelled     int := 0;
  n               int;
begin
  -- 1. Trial ran out. New signups always get a trial (20261203000000), so this is
  --    the transition that turns an abandoned signup into an expired tenant.
  with due as (
    update public.org_subscriptions
       set status = 'expired', updated_at = now()
     where status = 'trialing'
       and trial_ends_at is not null
       and trial_ends_at <= now()
    returning id, org_id, trial_ends_at
  )
  insert into public.subscription_events (org_id, event_type, payload)
  select org_id, 'subscription.trial_expired',
         jsonb_build_object('subscription_id', id, 'trial_ends_at', trial_ends_at)
    from due;
  get diagnostics n = row_count; v_trial_expired := n;

  -- 2. Paid period ended and auto-renew did not land -> grace window, not a hard stop.
  --    grace_days comes from the plan (default 7) so the platform sets the policy.
  update public.org_subscriptions s
     set status = 'past_due',
         grace_ends_at = now() + make_interval(days => coalesce(p.grace_days, 7)),
         updated_at = now()
    from public.billing_plans p
   where s.plan_id = p.id
     and s.status in ('active', 'payment_pending')
     and s.current_period_end is not null
     and s.current_period_end <= now()
     and (s.grace_ends_at is null or s.grace_ends_at <= now());
  get diagnostics n = row_count; v_past_due := n;

  -- Same transition for a subscription with no plan attached: fall back to 7 days.
  update public.org_subscriptions
     set status = 'past_due',
         grace_ends_at = now() + make_interval(days => 7),
         updated_at = now()
   where plan_id is null
     and status in ('active', 'payment_pending')
     and current_period_end is not null
     and current_period_end <= now()
     and (grace_ends_at is null or grace_ends_at <= now());
  get diagnostics n = row_count; v_past_due := v_past_due + n;

  -- 3. Grace window over -> expired. Writes stop, everything else stays reachable.
  with due as (
    update public.org_subscriptions
       set status = 'expired', grace_ends_at = null, updated_at = now()
     where status = 'past_due'
       and grace_ends_at is not null
       and grace_ends_at <= now()
    returning id, org_id, grace_ends_at
  )
  insert into public.subscription_events (org_id, event_type, payload)
  select org_id, 'subscription.expired',
         jsonb_build_object('subscription_id', id, 'grace_ended_at', grace_ends_at)
    from due;
  get diagnostics n = row_count; v_grace_expired := n;

  -- 4. Cancelled at the end of the period it already paid for.
  with due as (
    update public.org_subscriptions
       set status = 'expired', updated_at = now()
     where status = 'cancelled'
       and current_period_end is not null
       and current_period_end <= now()
    returning id, org_id, current_period_end
  )
  insert into public.subscription_events (org_id, event_type, payload)
  select org_id, 'subscription.expired',
         jsonb_build_object('subscription_id', id, 'period_end', current_period_end)
    from due;
  get diagnostics n = row_count; v_cancelled := n;

  return jsonb_build_object(
    'ok', true,
    'trial_expired', v_trial_expired,
    'moved_to_past_due', v_past_due,
    'grace_expired', v_grace_expired,
    'cancelled_expired', v_cancelled);
end $$;

-- Owned by the scheduler, not by tenants: triggering your own expiry early is
-- pointless but should not be reachable from a session either.
revoke execute on function public.run_subscription_lifecycle() from public, anon, authenticated;
grant execute on function public.run_subscription_lifecycle() to service_role;

-- Scheduled run. pg_cron is an extension the project owner enables from the
-- Supabase dashboard (same note as 0015_crm_automation.sql), so the schedule is
-- installed only when it is actually present — a fresh local `db reset` skips it
-- cleanly instead of failing. The edge function `subscription-lifecycle` is the
-- fallback/manual trigger for environments without pg_cron.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Re-running the migration must not stack duplicate schedules.
    if exists (select 1 from cron.job where jobname = 'subscription-lifecycle') then
      perform cron.unschedule('subscription-lifecycle');
    end if;
    perform cron.schedule('subscription-lifecycle', '*/15 * * * *',
                          $$select public.run_subscription_lifecycle()$$);
  end if;
end $do$;
