-- Cancelled is not a lockout (plan §8 + lifecycle step 4).
--
-- The plan's state table spells out write blocking for 'expired' and
-- 'suspended' but not for 'cancelled', and the lifecycle job has always
-- treated cancelled as a state that runs until current_period_end ("Cancelled
-- at the end of the period it already paid for") before flipping the row to
-- 'expired'. The entitlement function disagreed: it blocked writes the moment
-- a company cancelled, which locked staff out mid-day and made the later
-- cancelled -> expired transition pointless bookkeeping.
--
-- New rule, in one place (resolve_entitlements is the single source both the
-- app gate and any future DB consumer read):
--   expired / suspended      -> writes blocked from the moment they are set
--   cancelled, period still running -> writes allowed (auto_renew is off)
--   cancelled, period over (or no period) -> writes blocked until renewal
-- Reads, billing, export and support stay open for all of them either way.

create or replace function public.resolve_entitlements(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  v_sub record;
  v_plan record;
  v_status text;
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
begin
  select * into v_sub from public.org_subscriptions
    where org_id = p_org order by created_at desc limit 1;

  if v_sub is null then
    -- No subscription: minimal read-only entitlements
    return jsonb_build_object('status','none','features',jsonb_build_object(),'limits',jsonb_build_object('branches',1,'employees',3,'customers',100,'storage_mb',100));
  end if;

  v_status := v_sub.status;
  -- grace window handling
  if v_status = 'past_due' and v_sub.grace_ends_at is not null and v_sub.grace_ends_at > now() then
    v_status := 'grace';
  end if;

  select * into v_plan from public.billing_plans where id = v_sub.plan_id;

  if v_plan is null then
    return jsonb_build_object('status', v_status, 'features', jsonb_build_object(), 'limits', jsonb_build_object());
  end if;

  v_features := coalesce(v_plan.features, '{}'::jsonb);
  v_limits := jsonb_build_object(
    'branches', v_plan.max_branches,
    'employees', v_plan.max_employees,
    'customers', v_plan.max_customers,
    'storage_mb', v_plan.storage_mb
  );

  -- Expired/suspended block writes immediately. Cancelled only blocks once the
  -- period it already paid for has ended (the daily lifecycle job then moves
  -- the row to 'expired', so the blocked state never dangles on 'cancelled').
  if v_status in ('expired','suspended')
     or (v_status = 'cancelled'
         and (v_sub.current_period_end is null or v_sub.current_period_end <= now())) then
    v_features := v_features || jsonb_build_object('_writes_blocked', true);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'trial_ends_at', v_sub.trial_ends_at,
    'grace_ends_at', v_sub.grace_ends_at,
    'current_period_end', v_sub.current_period_end,
    'features', v_features,
    'limits', v_limits
  );
end $$;

grant execute on function public.resolve_entitlements(uuid) to authenticated, service_role;
