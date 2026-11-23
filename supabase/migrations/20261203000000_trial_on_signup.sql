-- Trial-on-signup + subscription lifecycle correctness.
-- 1. Widen org_subscriptions.status to the full lifecycle (the foundation CHECK
--    only allowed inactive/trialing/active/past_due/cancelled, so 'expired' and
--    'suspended' written by the platform workspace would have been rejected).
-- 2. create_organisation() now starts a trial so a brand-new company is never
--    stuck in status 'none' (which blocks every write).

-- ── 1. Full lifecycle status ──────────────────────────────────────────────────
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.org_subscriptions'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%';
  if c is not null then
    execute format('alter table public.org_subscriptions drop constraint %I', c);
  end if;
end $$;

alter table public.org_subscriptions
  add constraint org_subscriptions_status_check
  check (status in ('inactive','trialing','active','payment_pending','payment_failed',
                    'past_due','expired','suspended','cancelled'));

-- ── 2. Organisation onboarding starts a trial ────────────────────────────────
create or replace function public.create_organisation(p_name text, p_branch_name text, p_branch_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_org uuid; v_br uuid; v_name text;
  v_plan uuid; v_days int; v_end timestamptz;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
  if exists (select 1 from profiles where id = v_uid and org_id is not null and is_approved) then raise exception 'You already belong to an organisation'; end if;
  -- First-run bootstrap (no approved member yet), or an allow-listed platform
  -- operator (legacy table or the platform_users scope). Everything else is
  -- invitation-only. Keyed on members rather than organisation rows so the demo
  -- tenant seeded by 0001_foundation cannot lock a fresh install out of setup.
  if exists (select 1 from profiles where org_id is not null and is_approved)
     and not exists (select 1 from platform_admins where user_id = v_uid)
     and not exists (select 1 from platform_users where user_id = v_uid and is_active) then
    raise exception 'Organisation creation is by invitation only' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_branch_name, ''))) < 2 or length(trim(coalesce(p_branch_code, ''))) < 1 then raise exception 'Organisation and branch names are required'; end if;

  insert into organizations (name) values (trim(p_name)) returning id into v_org;

  -- Trial: prefer an active public plan, fall back to any public plan, then any
  -- plan. A new organisation must never land in status 'none' (writes blocked).
  select id, trial_days into v_plan, v_days from public.billing_plans
    where is_public and active order by display_order limit 1;
  if v_plan is null then
    select id, trial_days into v_plan, v_days from public.billing_plans
      where is_public order by display_order limit 1;
  end if;
  if v_plan is null then
    select id, trial_days into v_plan, v_days from public.billing_plans
      order by display_order limit 1;
  end if;

  if v_plan is not null then
    v_end := now() + make_interval(days => coalesce(nullif(v_days, 0), 14));
    insert into public.org_subscriptions
      (org_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, auto_renew)
    values (v_org, v_plan, 'trialing', v_end, now(), v_end, true);
    insert into public.subscription_events (org_id, event_type, payload, actor_id)
    values (v_org, 'subscription.trial_started',
            jsonb_build_object('plan_id', v_plan, 'trial_days', coalesce(v_days, 14)), v_uid);
  end if;

  insert into branches (org_id, code, name) values (v_org, upper(trim(p_branch_code)), trim(p_branch_name)) returning id into v_br;
  select coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1)) into v_name from auth.users where id = v_uid;
  insert into profiles (id, org_id, full_name, role_key, branch_id, is_approved, deactivated) values (v_uid, v_org, v_name, 'owner', v_br, true, false)
  on conflict (id) do update set org_id = v_org, role_key = 'owner', branch_id = v_br, is_approved = true, deactivated = false;
  return v_org;
end $$;

grant execute on function public.create_organisation(text, text, text) to authenticated;
revoke execute on function public.create_organisation(text, text, text) from anon, public;
