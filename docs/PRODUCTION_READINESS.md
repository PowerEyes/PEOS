# PowerOS — Tenancy / RBAC production-readiness report

## Gap report (found → fixed)
| # | Sev | Gap | Fix |
|---|-----|-----|-----|
| 1 | Critical | RLS was org-only: any staff read/wrote every branch's sales, stock, finance | Branch-scoped RLS (`can_access_branch`) on sales, stock, lab, repairs, appointments, credit notes; manager-only finance tables |
| 2 | Critical | `profiles` had no UPDATE policy: approve/role/deactivate silently did nothing yet UI said "success" | Removed direct writes; `admin_update_staff` RPC with role-hierarchy, self-change and last-owner protection |
| 3 | Critical | Pending staff invisible to admins; any admin could claim any signup | Invitation-only access (`invite_staff`, `claim_invitation` requires confirmed matching email) |
| 4 | Critical | `using (true)` on `coupon_uses`, `cron_runs` | Org-scoped / admin-only |
| 5 | High | Free-text roles, no branch manager | Constrained roles: owner, admin, branch_manager, staff |
| 6 | High | Deactivated users kept access until JWT expiry | `current_org()` checks `deactivated`; middleware re-checks profile each request |
| 7 | High | No route-level RBAC (direct URL to /staff, /finance) | `lib/rbac.ts` + middleware guard |
| 8 | High | SECURITY DEFINER RPCs bypass RLS | `enforce_branch_write` trigger rejects out-of-branch writes by signed-in users |
| 9 | High | Hardcoded org id in ERP (8 places) | Removed; RLS + `org_id` defaults |
| 10 | High | No transfers / temporary access | `branch_transfers` (request→approve→receive, stock movements), `staff_assignments` (≤90 days, reason, auto-expire, revocable) |
| 11 | Medium | Audit only on customers; log mutable | Audit on profiles/assignments/invitations/transfers; `audit_log` append-only |
| 12 | Medium | No org onboarding | `create_organisation` (first-run or platform admin only) + /onboarding |
| 13 | Medium | CRM function triggers open to any staff | admin check |

## Verified here
- `apps/erp/tests/rbac.test.mjs` — 4 suites pass (`node --experimental-strip-types --test`).
- Token/HMAC logic smoke-tested earlier.

## NOT verified (no Postgres / network in the build sandbox) — must run before go-live
1. Apply migrations on a staging copy of production data: `supabase db reset` (fresh) and `supabase db push` (existing).
2. `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rbac_rls.test.sql` (≈35 assertions: tenant isolation, branch scope, escalation, temp access, transfers, deactivation, audit).
3. `pnpm install && pnpm -r exec tsc --noEmit && pnpm -r build`.
4. Manual regression: POS sale, lab advance, repair, appointment, WhatsApp document link, website order, per role.

## Follow-up round (closed)
| Gap | Fix |
|-----|-----|
| Storefront / edge functions single-org | `org_domains` + `org_for_host`; storefront resolves tenant from host (`DEFAULT_ORG_ID` fallback); edge jobs fan out per org; order-whatsapp uses the order's org; signups carry the storefront org; admin UI **Settings → Store Domains** |
| Auto-assigned branches unreviewed | `branch_reviewed` flag, amber banner + "Confirm branch" chip in Staff |
| Staff lost finance/catalogue/day-closing | Configurable `role_permissions` (finance_view, expenses, day_closing, catalogue_edit) enforced in RLS + routes + nav; admin grid in Staff → Role permissions (defaults: managers yes, staff no) |
| Storage not branch-aware / exports unaudited | repair-images read limited to customers with repairs the user can access; every CSV export logged (`log_export`) |
| No rate limiting | DB-backed `rate_limit_hit`: track-order (IP + per-order), OCR (web IP, ERP per user), order-confirm |

## Remaining blockers / known limits
- Razorpay keys are still global env vars (one payment account for all tenants); per-tenant keys need an `org_payment_settings` table.
- Storefront theme/CMS/content seeds are shared defaults; each new organisation starts empty.
- Rate limiter fails open if the DB errors (logged).
- Domain claims are first-come; add DNS verification if tenants are untrusted.
- Prescriptions storage stays org-wide by design (shared customer identity).
---
(superseded items below kept for history)
- **Storefront (apps/web), edge functions and seed data are still single-organisation** (hardcoded org id, `sync_auth_to_customer`). True multi-tenant SaaS needs domain→org mapping. ERP is multi-org ready.
- Existing approved non-admin staff without a branch were back-filled to the org's first branch — review in Staff.
- Product/catalogue writes are now manager-only; day closing and expenses are manager-only (behaviour change for plain staff).
- Customers/prescriptions are intentionally org-shared (shared identity); sales/stock/finance are branch-scoped.
- Storage buckets are org-scoped, not branch-scoped. Read-access auditing (exports) is not logged.
- No rate limiting on `/api/track-order`, `/api/ocr`.

## Deployment requirements
Env: `SUPABASE_SERVICE_ROLE_KEY` (invites), `DOC_LINK_SECRET`, `NEXT_PUBLIC_ERP_URL`, `RAZORPAY_WEBHOOK_SECRET`. Supabase Auth: **enable email confirmation** (claiming an invite depends on it) and configure SMTP + redirect URL. Apply migrations in order incl. `20261121*` and `20261122*`. Insert platform admins manually into `platform_admins` to allow extra organisations.
