# E2E environment

The Playwright suite covers four apps:

| Project | App | Base URL | Auth |
| --- | --- | --- | --- |
| `setup` | ERP login | `ERP_URL` (default `http://localhost:3001`) | `ERP_EMAIL` / `ERP_PASSWORD` |
| `erp` | ERP flows | `ERP_URL` | storage state from `setup` |
| `web` | Storefront | `WEB_URL` (default `http://localhost:3000`) | public |
| `platform` | SaaS control plane | `PLATFORM_URL` (default `http://localhost:3002`) | public smoke only |
| `website` | SaaS marketing site | `WEBSITE_URL` (default `http://localhost:3003`) | public smoke only |

## Required environment

Set these before running `pnpm exec playwright test`:

- `ERP_EMAIL` / `ERP_PASSWORD`: a disposable ERP owner account. `auth.setup.ts`
  skips authenticated ERP specs when either is missing.
- `E2E_DATABASE_URL`: a disposable Postgres URL. Database-backed helpers read
  stock, totals and catalogue rows from it. Never point mutating specs at
  production data.
- `DATABASE_URL`: used as a fallback by read-only helpers when
  `E2E_DATABASE_URL` is absent.
- `ERP_URL`, `WEB_URL`, `PLATFORM_URL`, `WEBSITE_URL`: override when the apps run
  on non-default ports or on a remote host.

All four Next.js apps must be running. The internal email service
(`services/email`) must be running for signup/invitation smoke tests. The OCR
service (`services/ocr`) requires a Docker daemon and provisioned PaddleOCR
model weights; without them the ERP reports OCR as unreachable.

## Running

```sh
node server.js                              # from services/email; optional, for signup/invites
pnpm dev                                    # all four apps via turbo
pnpm exec playwright test --project=platform --project=website
pnpm exec playwright test --project=setup --project=erp --project=web
```

`playwright.config.ts` defines all five projects above (including the two
unauthenticated smoke projects). Running the full suite without `ERP_EMAIL`,
`ERP_PASSWORD`, and `E2E_DATABASE_URL` still passes the public smoke checks but
the ERP and database-backed storefront specs fail fast with a clear
"Set E2E_DATABASE_URL…" error; that is expected, not an app regression.

Diagnostics specs use `domcontentloaded` instead of `networkidle` because the
ERP keeps long-lived polling connections open. They filter known dev-only noise
(favicon 404s, HMR, React DevTools, ResizeObserver aborts).

## Creating a disposable ERP account

Use the Supabase admin API (or dashboard) to create a user, then insert a
matching `profiles` row with `role_key = 'owner'`, `is_approved = true`, and an
existing `org_id` / `branch_id`. Delete the profile and auth user after the run.
The signup cleanup helper in `apps/saas-website/app/(website)/api/auth/signup`
follows the same rule: delete dependent rows before deleting the auth user.

## Last verified

- `pnpm exec playwright test --project=platform --project=website`: **11 passed**.
  The missing `platform`/`website` projects were added to `playwright.config.ts`,
  so the documented command now works.
- `pnpm exec playwright test`: previously passed with a disposable owner
  (**33 passed, 1 pre-existing skip** in the appointments suite); the account was
  deleted afterwards. A later full run without E2E credentials/DSN correctly
  ran the public smoke checks and failed the DB-backed specs with the explicit
  environment error, then its `test-results`/`playwright-report` artifacts were
  removed.
- ERP and web middleware now treats stale/invalid Supabase refresh tokens and
  transient auth fetch failures as anonymous, clears stale `sb-*-auth-token`
  cookies, and skips auth work for `/sw.js`. A no-op service worker was added to
  `apps/erp/public/sw.js` so stale registrations no longer return 404.
- `typecheck`, `lint`, and `build` pass for `apps/web`, `apps/erp`,
  `apps/saas-platform`, and `apps/saas-website`. The two older apps still emit
  non-blocking `<img>`/hook-dependency warnings.
- Live Supabase DDL was applied with the service role:
  `20261127000000_platform_live_alignment.sql`,
  `20261127010000_guide_accessories.sql`, and the public-plan function from
  `20261228000000_saas_leads_public_plans.sql`. The three public billing plans
  are active, so `/pricing` renders the live catalogue.
- HTTP smoke checks passed for the internal integration-health token gate,
  Razorpay webhook signature rejection, ERP sign-in redirect, platform
  logout/login validation, website login validation, the accessories guide, and
  email-service health.

External setup cannot be verified from this machine: configure the Razorpay
webhook secret in the dashboard, point production email at a real transport, and
provision OCR model weights on a host with Docker/Python.

## Latest production-build check

All four apps now build and run in production mode (`pnpm --filter <app> build`
followed by `pnpm --filter <app> start`):

| App | URL | Smoke status |
| --- | --- | --- |
| `@poweros/web` | `http://localhost:3000` | `200` |
| `@poweros/erp` | `http://localhost:3001` | `307` → login |
| `poweros-saas-platform` | `http://localhost:3002` | `307` → login |
| `@poweros/saas-website` | `http://localhost:3003` | `200` |
| `@poweros/email-service` | `http://localhost:4000` | `200` `/health` |

Platform login and authenticated dashboard both return `200`; the website health
endpoint and the accessories guide return `200`; a bad Razorpay signature is
rejected with `400`.

The stale Postgres password in the gitignored `.env` was replaced with a working
DSN; both `DATABASE_URL` and `SUPABASE_DB_URL` now connect. A subsequent full
Playwright run initially exposed stale test assumptions: the baseline specs
needed to be scoped to the seeded tenant (the database now also contains a
Nish Optics tenant) and to read cost from `product_costs`; the storefront copy
assertions needed to match the current `In Stock` / `Currently Out of Stock`
labels; and the ERP PO picker page needed to join `product_costs`. After those
fixes the full production-mode suite passes: **33 passed, 1 skipped**. The
disposable ERP owner and its auth state were removed after the run.
