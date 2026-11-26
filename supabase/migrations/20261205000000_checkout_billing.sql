-- 20261205000000_checkout_billing.sql
-- Subscription checkout (plan phase 3): link a Razorpay order to an invoice,
-- number tax invoices sequentially, make webhook events replay-safe, and hold the
-- platform's own GST identity.
--
-- Money stays privileged. subscription_invoices / subscription_payments keep their
-- SELECT-only RLS (20261201000000), so a tenant session can never insert an invoice
-- or mark one paid. Only server actions that have verified a Razorpay signature and
-- the webhook — both running through supabaseBilling() — can settle a payment.

-- 1. Invoice <-> Razorpay order linkage, plus the plan being purchased.
alter table public.subscription_invoices
  add column if not exists provider_order_id text,
  add column if not exists plan_id uuid references public.billing_plans(id),
  add column if not exists invoice_no text;

create unique index if not exists subscription_invoices_provider_order_key
  on public.subscription_invoices (provider_order_id)
  where provider_order_id is not null;

create unique index if not exists subscription_invoices_invoice_no_key
  on public.subscription_invoices (invoice_no)
  where invoice_no is not null;

create index if not exists subscription_invoices_org_status_idx
  on public.subscription_invoices (org_id, status, issued_at desc);

-- 2. Sequential GST invoice numbers: INV-YYYYMM-00001.
--    Assigned in the database so the checkout action and the webhook cannot drift.
create sequence if not exists public.subscription_invoice_seq;

create or replace function public.assign_subscription_invoice_no()
returns trigger
language plpgsql
set search_path = public as $$
begin
  if new.invoice_no is null or new.invoice_no = '' then
    new.invoice_no := 'INV-' || to_char(coalesce(new.issued_at, now()), 'YYYYMM')
                   || '-' || lpad(nextval('public.subscription_invoice_seq')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists subscription_invoice_no on public.subscription_invoices;
create trigger subscription_invoice_no
  before insert on public.subscription_invoices
  for each row execute function public.assign_subscription_invoice_no();

-- 3. Webhook replay protection. provider_payment_id is already unique on
--    subscription_payments; this makes *any* Razorpay event idempotent, including
--    ones that do not carry a payment id.
alter table public.subscription_events
  add column if not exists provider_event_id text;

create unique index if not exists subscription_events_provider_event_key
  on public.subscription_events (provider_event_id)
  where provider_event_id is not null;

create index if not exists subscription_events_org_type_idx
  on public.subscription_events (org_id, event_type, created_at desc);

-- 4. The platform's own GST details. Not per-tenant: PowerOS issues these invoices,
--    so a single rate + GSTIN lives in platform_settings (platform admins only).
insert into public.platform_settings (key, value) values
  ('saas_gst_rate_bp', '1800'),
  ('saas_gstin', '""')
on conflict (key) do nothing;

-- billing_plans is a price catalogue: names, prices and limits are meant to be read
-- by every signed-in tenant. It ships with RLS on and no policy at all, so the app
-- was reading an empty plan list (only superuser test scripts could see the rows).
drop policy if exists billing_plans_read on public.billing_plans;
create policy billing_plans_read on public.billing_plans
  for select to authenticated using (true);

-- The GSTIN has to appear on the customer's own tax invoice, but platform_settings
-- itself is platform-admin only. This exposes just those two non-sensitive values.
create or replace function public.platform_billing_identity()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gstin', coalesce((select value #>> '{}' from public.platform_settings where key = 'saas_gstin'), ''),
    'gst_rate_bp', coalesce((select (value #>> '{}')::int from public.platform_settings where key = 'saas_gst_rate_bp'), 1800)
  );
$$;
revoke execute on function public.platform_billing_identity() from public, anon;
grant execute on function public.platform_billing_identity() to authenticated, service_role;

-- 5. Settlement: the single place a payment becomes a paid invoice and an active
--    subscription. Idempotent, so the browser callback and the Razorpay webhook can
--    both call it and only the first one does the work.
--
--    EXECUTE is revoked from anon/authenticated on purpose. A tenant that could call
--    this directly could mark its own invoice paid without paying, so only the
--    service role reaches it — after the caller has verified a Razorpay signature.
create or replace function public.settle_subscription_payment(
  p_org_id uuid,
  p_invoice_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_minor bigint,
  p_provider text default 'razorpay'
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_sub     public.org_subscriptions%rowtype;
  v_plan    public.billing_plans%rowtype;
  v_end     timestamptz;
begin
  select * into v_invoice
    from public.subscription_invoices
   where (p_invoice_id is not null and id = p_invoice_id)
      or (p_invoice_id is null and p_provider_order_id is not null and provider_order_id = p_provider_order_id)
   limit 1;
  if not found then
    raise exception 'subscription invoice not found';
  end if;
  if p_org_id is not null and v_invoice.org_id <> p_org_id then
    raise exception 'subscription invoice belongs to another organisation';
  end if;

  -- Replay / double callback: settle exactly once, report success either way.
  if v_invoice.status = 'paid' then
    return jsonb_build_object('ok', true, 'already_paid', true,
                              'invoice_id', v_invoice.id, 'invoice_no', v_invoice.invoice_no,
                              'org_id', v_invoice.org_id);
  end if;

  -- provider_payment_id is UNIQUE, so a concurrent replay lands here and is ignored.
  begin
    insert into public.subscription_payments
      (invoice_id, org_id, provider, provider_payment_id, status, amount_minor)
    values
      (v_invoice.id, v_invoice.org_id, p_provider, p_provider_payment_id, 'succeeded', p_amount_minor);
  exception when unique_violation then
    null;
  end;

  update public.subscription_invoices
     set status = 'paid', paid_at = coalesce(paid_at, now())
   where id = v_invoice.id;

  select * into v_plan from public.billing_plans where id = v_invoice.plan_id;
  if found then
    v_end := now() + case when v_plan.interval = 'year' then interval '1 year' else interval '1 month' end;

    select * into v_sub from public.org_subscriptions
     where org_id = v_invoice.org_id
     order by created_at desc limit 1;

    if not found then
      insert into public.org_subscriptions
        (org_id, plan_id, status, provider, provider_subscription_id,
         current_period_start, current_period_end, auto_renew)
      values
        (v_invoice.org_id, v_plan.id, 'active', p_provider, p_provider_payment_id, now(), v_end, true);
    else
      update public.org_subscriptions
         set plan_id = v_plan.id,
             status = 'active',
             provider = p_provider,
             provider_subscription_id = p_provider_payment_id,
             current_period_start = case when current_period_end is null or current_period_end < now()
                                         then now() else current_period_start end,
             current_period_end = greatest(coalesce(current_period_end, now()), now())
                                + case when v_plan.interval = 'year' then interval '1 year' else interval '1 month' end,
             auto_renew = true,
             cancelled_at = null,
             grace_ends_at = null,
             reactivated_at = case when status in ('cancelled','expired','suspended') then now() else reactivated_at end
       where id = v_sub.id;
    end if;
  end if;

  insert into public.subscription_events (org_id, event_type, payload)
  values (v_invoice.org_id, 'subscription.payment_succeeded', jsonb_build_object(
    'invoice_id', v_invoice.id,
    'invoice_no', v_invoice.invoice_no,
    'provider_order_id', v_invoice.provider_order_id,
    'provider_payment_id', p_provider_payment_id,
    'amount_minor', p_amount_minor,
    'plan_id', v_invoice.plan_id));

  return jsonb_build_object('ok', true, 'already_paid', false,
                            'invoice_id', v_invoice.id, 'invoice_no', v_invoice.invoice_no,
                            'org_id', v_invoice.org_id);
end $$;

revoke execute on function public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)
  to service_role;
