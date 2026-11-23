-- Subscription checkout + lifecycle test. Run against a scratch DB with all migrations:
--   psql -v ON_ERROR_STOP=1 -f saas_checkout.sql
-- Everything runs in one transaction and is rolled back.
begin;
create temp table _c as select
  gen_random_uuid() org, gen_random_uuid() org_trial, gen_random_uuid() org_due, gen_random_uuid() org_grace,
  gen_random_uuid() u_owner, gen_random_uuid() inv,
  gen_random_uuid() sub_trial, gen_random_uuid() sub_due, gen_random_uuid() sub_grace;
grant select on _c to public;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
declare v_state text := null; v_msg text := null;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics v_state = RETURNED_SQLSTATE;
    v_msg = SQLERRM;
  end;
  if v_state is null then
    raise exception 'FAIL (should be blocked): %', label;
  elsif v_state <> '42501' then
    raise exception 'FAIL: % was blocked for the wrong reason (%): %', label, v_state, v_msg;
  end if;
  raise notice 'ok   blocked: %', label;
end $$;
create or replace function pg_temp.expect_rows(sql text, want int, label text) returns void language plpgsql as $$
declare n int; begin execute 'select count(*) from (' || sql || ') q' into n;
  if n <> want then raise exception 'FAIL: % (got %, want %)', label, n, want; end if; raise notice 'ok   %', label; end $$;

insert into organizations (id, name) values
  ((select org from _c), 'Checkout Test Co'),
  ((select org_trial from _c), 'Trial Expiry Co'),
  ((select org_due from _c), 'Period Ended Co'),
  ((select org_grace from _c), 'Grace Over Co');

-- ✅ Catalogue reads ---------------------------------------------------------
-- billing_plans ships with RLS on and no policy at all, so the app used to read an
-- empty plan list. The new billing_plans_read policy is what checkout depends on.
select pg_temp.as_user(u_owner) from _c;
select pg_temp.expect_rows($q$select 1 from billing_plans where code = 'starter'$q$,
  1, 'tenant reads the plan catalogue (billing_plans RLS fix)');
select pg_temp.expect_rows(
  $q$select 1 from platform_billing_identity() b
       where b ->> 'gstin' = '' and (b ->> 'gst_rate_bp')::int = 1800$q$,
  1, 'tenant reads the platform GST identity for its own invoice');
reset role;

select pg_temp.expect_rows(
  $q$select 1 from platform_settings where key in ('saas_gst_rate_bp', 'saas_gstin')$q$,
  2, 'platform GST settings are seeded');

-- ✅ Invoice numbering -------------------------------------------------------
insert into subscription_invoices (id, org_id, plan_id, amount_minor, tax_minor, currency, status, provider_order_id)
select inv, org, (select id from billing_plans where code = 'starter'), 99900, 15238, 'INR', 'issued', 'order_test_1'
from _c;
select pg_temp.expect_rows(
  $q$select 1 from subscription_invoices where id = (select inv from _c)
       and invoice_no ~ '^INV-[0-9]{6}-[0-9]{5}$'$q$,
  1, 'tax invoice number assigned by trigger');

-- ✅ Settlement is service-role only ----------------------------------------
select pg_temp.as_user(u_owner) from _c;
select pg_temp.expect_fail(
  $q$select public.settle_subscription_payment(null, null, null, null, 0, 'razorpay')$q$,
  'tenant cannot execute settle_subscription_payment (a forged paid invoice would be free credit)');
reset role;

-- ✅ Settlement activates the plan ------------------------------------------
select pg_temp.expect_rows(
  $q$select 1 from public.settle_subscription_payment(
       (select org from _c), (select inv from _c), 'order_test_1', 'pay_test_1', 99900, 'razorpay') r
     where (r ->> 'ok')::boolean and not (r ->> 'already_paid')::boolean$q$,
  1, 'settlement reports success on the first call');
select pg_temp.expect_rows(
  $q$select 1 from subscription_invoices where id = (select inv from _c)
       and status = 'paid' and paid_at is not null$q$,
  1, 'invoice marked paid');
select pg_temp.expect_rows(
  $q$select 1 from subscription_payments
       where org_id = (select org from _c) and provider_payment_id = 'pay_test_1'
         and status = 'succeeded' and amount_minor = 99900 and invoice_id = (select inv from _c)$q$,
  1, 'payment recorded against the invoice');
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions
       where org_id = (select org from _c) and status = 'active'
         and plan_id = (select id from billing_plans where code = 'starter')
         and current_period_end > now() and auto_renew$q$,
  1, 'subscription activated with a future period end');
select pg_temp.expect_rows(
  $q$select 1 from subscription_events
       where org_id = (select org from _c) and event_type = 'subscription.payment_succeeded'$q$,
  1, 'payment event recorded');

-- ✅ Idempotent replay -------------------------------------------------------
-- The browser callback and the webhook both settle; whichever lands second must
-- change nothing.
select pg_temp.expect_rows(
  $q$select 1 from public.settle_subscription_payment(
       (select org from _c), (select inv from _c), 'order_test_1', 'pay_test_1', 99900, 'razorpay') r
     where (r ->> 'already_paid')::boolean$q$,
  1, 'replaying settlement reports already paid');
select pg_temp.expect_rows(
  $q$select id from subscription_payments where provider_payment_id = 'pay_test_1'$q$,
  1, 'replay does not duplicate the payment');
select pg_temp.expect_rows(
  $q$select id from org_subscriptions where org_id = (select org from _c)$q$,
  1, 'replay does not duplicate the subscription');
select pg_temp.expect_rows(
  $q$select id from subscription_events
       where org_id = (select org from _c) and event_type = 'subscription.payment_succeeded'$q$,
  1, 'replay does not re-emit the payment event');

-- ✅ Webhook replay guard ----------------------------------------------------
insert into subscription_events (org_id, event_type, payload, provider_event_id)
values ((select org from _c), 'razorpay.payment.captured', '{}'::jsonb, 'evt_replay_1');
do $do$
begin
  begin
    insert into subscription_events (org_id, event_type, payload, provider_event_id)
    values ((select org from _c), 'razorpay.payment.captured', '{}'::jsonb, 'evt_replay_1');
    raise exception 'FAIL: duplicate provider_event_id was accepted';
  exception when unique_violation then
    raise notice 'ok   duplicate webhook event rejected (unique provider_event_id)';
  end;
end $do$;

-- ✅ Lifecycle transitions ---------------------------------------------------
insert into org_subscriptions (id, org_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
select sub_trial, org_trial, (select id from billing_plans where code = 'starter'),
       'trialing', now() - interval '1 day', now() - interval '15 days', null from _c;
insert into org_subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end)
select sub_due, org_due, (select id from billing_plans where code = 'starter'),
       'active', now() - interval '31 days', now() - interval '1 hour' from _c;
insert into org_subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end, grace_ends_at)
select sub_grace, org_grace, (select id from billing_plans where code = 'starter'),
       'past_due', now() - interval '60 days', now() - interval '31 days', now() - interval '1 hour' from _c;

select public.run_subscription_lifecycle();

select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions where id = (select sub_trial from _c) and status = 'expired'$q$,
  1, 'trial past trial_ends_at expires');
select pg_temp.expect_rows(
  $q$select 1 from subscription_events
       where org_id = (select org_trial from _c) and event_type = 'subscription.trial_expired'$q$,
  1, 'trial expiry emits an event');
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions
       where id = (select sub_due from _c) and status = 'past_due' and grace_ends_at > now()$q$,
  1, 'period end moves active -> past_due with a grace window');
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions where id = (select sub_grace from _c) and status = 'expired'$q$,
  1, 'past_due past grace_ends_at expires');
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions where id = (select sub_trial from _c) and trial_ends_at is not null$q$,
  1, 'expiry keeps the row (no tenant data is deleted)');

-- Running the job again must not re-transition or re-emit.
select public.run_subscription_lifecycle();
select pg_temp.expect_rows(
  $q$select 1 from subscription_events
       where org_id = (select org_trial from _c) and event_type = 'subscription.trial_expired'$q$,
  1, 'second lifecycle run does not re-emit trial expiry');
select pg_temp.expect_rows(
  $q$select 1 from org_subscriptions where id = (select sub_due from _c) and status = 'past_due'$q$,
  1, 'second lifecycle run leaves an open grace window alone');

-- ✅ Expired is restricted, not locked out -----------------------------------
select pg_temp.expect_rows(
  $q$select 1 from public.resolve_entitlements((select org_grace from _c)) e
       where e ->> 'status' = 'expired'
         and (e -> 'features' ->> '_writes_blocked')::boolean$q$,
  1, 'expired tenant keeps entitlements with writes blocked (reads/billing stay open)');

rollback;
\echo 'ALL SAAS CHECKOUT CHECKS PASSED'
