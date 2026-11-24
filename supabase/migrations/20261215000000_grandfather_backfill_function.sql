-- Grandfathering backfill as a first-class, testable function
-- (plan §11 criterion 9: "migrations apply cleanly to an existing DB;
-- backfill grandfathered plans").
--
-- 20261201000000 step 9 ran this exact statement inline during the original
-- rollout. Extracting it here makes it re-runnable (idempotent — only
-- organisations with NO subscription row at all are touched) so a restored or
-- imported database can reach the same invariant, and supabase/tests/
-- saas_platform.sql can assert the behaviour for real instead of trusting the
-- statement exists.
--
-- Scope: an organisation with no subscription row resolves to status 'none'
-- (writes blocked, reads only). Grandfathering it onto the hidden, free
-- 'legacy' plan is exactly what the plan promises for pre-subscription data.
-- Any organisation that already has a subscription row — trialing, expired,
-- cancelled, whatever — is never touched; its own history is preserved.
--
-- EXECUTE is revoked from tenant roles: only the migration superuser and the
-- service role can run it (org_subscriptions writes are service-side anyway).

create or replace function public.backfill_grandfather_subscriptions()
returns integer language sql security definer set search_path = public as $$
  with inserted as (
    insert into public.org_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
    select o.id, (select id from public.billing_plans where code = 'legacy'), 'active',
           now(), now() + interval '10 years'
    from public.organizations o
    where not exists (select 1 from public.org_subscriptions s where s.org_id = o.id)
    returning 1
  )
  select count(*) from inserted;
$$;

revoke execute on function public.backfill_grandfather_subscriptions() from public, anon, authenticated;
grant execute on function public.backfill_grandfather_subscriptions() to service_role;

-- Re-apply the invariant on every migration run (no-op on a healthy database).
select public.backfill_grandfather_subscriptions();
