# Supabase Edge Functions

Deployed with the Supabase CLI from the repo root:

```sh
supabase functions deploy razorpay-webhook
supabase functions deploy subscription-lifecycle
```

Secrets are set once per project (they are *not* read from `.env`):

```sh
supabase secrets set RAZORPAY_WEBHOOK_SECRET=...        # razorpay-webhook only
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
```

## Billing functions (subscription checkout)

### `razorpay-webhook`

The authoritative payment path. Razorpay POSTs here after a payment settles, so the
plan activates even if the browser callback never ran (closed tab, dropped
connection).

| Setting | Value | Why |
| --- | --- | --- |
| `verify_jwt` | `false` (in `supabase/config.toml`) | Razorpay sends no Supabase JWT. The handler instead requires a valid `x-razorpay-signature`. |
| Required secret | `RAZORPAY_WEBHOOK_SECRET` | Must match the secret configured in the Razorpay dashboard (Settings → Webhooks). Without it the function answers `503` and trusts nothing. |

Handled events:

- `payment.captured` — verifies the captured paise match the invoice, then calls
  `public.settle_subscription_payment()`. A mismatch is recorded as
  `subscription.payment_amount_mismatch` and **does not** activate a plan.
- `payment.failed` — recorded as `subscription.payment_failed`.
- anything else — acknowledged so Razorpay stops retrying.

Replays are idempotent twice over: `subscription_events.provider_event_id` is
unique (dedupe), and `settle_subscription_payment()` itself is idempotent.

Configure the webhook URL in Razorpay as
`https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`.

### `subscription-lifecycle`

Runs trial expiry, grace windows, cancellation and expiry by calling
`public.run_subscription_lifecycle()` — the same SQL function the schedule uses, so
there is one implementation of the transitions.

Manual invocation requires the service-role token:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/subscription-lifecycle" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Scheduling

The real schedule is a **pg_cron** job installed by
`20261206000000_subscription_lifecycle.sql`:

```sql
select cron.schedule('subscription-lifecycle', '*/15 * * * *',
                     $$select public.run_subscription_lifecycle()$$);
```

That migration only installs the job when the `pg_cron` extension is present, so a
local `supabase db reset` skips it instead of failing. Enable it in the Supabase
dashboard under **Database → Extensions**, then re-run the migration (or schedule
the line by hand).

If pg_cron is unavailable, deploy `subscription-lifecycle` and invoke it from
whatever scheduler you already have.

## Other functions in this directory

`abandoned-cart`, `birthday-greeting`, `order-whatsapp`, `rx-expiry-reminder` —
CRM/WhatsApp jobs. Shared helpers live in `_shared/`.
