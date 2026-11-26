# PowerOS Commercial Production Readiness Audit

**Audit date:** 25 November 2026  
**Source:** Supplied `PEOS-main-navigation-updated.zip` and its included production schema snapshot / test evidence.  
**Decision:** **NO-GO for general commercial production deployment.**  
**Scope:** Static code/schema audit, selected code corrections, unit tests and release-gate preparation. This is not a live staging or production sign-off.

## Executive decision

PowerOS has a substantial foundation, but it is not yet safe to market as a fully verified, multi-tenant optical ERP. The current audit fixed several concrete defects and improved the release gates. However, production database migrations have not been applied, the database/RLS suites were not run in this environment, payment gateway recovery was not tested against Razorpay, and modules F–L still lack end-to-end evidence in the supplied pilot report.

Do not onboard paying shops as their sole system of record until the P0 gates below are passed.

## Evidence-based checks completed in this workspace

| Check | Result | Meaning |
|---|---:|---|
| ERP unit tests | **52 passed / 0 failed** | Includes RBAC, subscription, GST and new storefront settlement guard tests |
| Migration filename/version audit | **75 unique versions** | No duplicate migration versions; does not prove SQL applies |
| TypeScript/TSX syntax transpilation | **27 files, no syntax errors** | Syntax only; not a full typecheck or Next.js build |
| Sidebar / Quick Create route audit | **60 references, 0 missing** | Static route existence check |
| Application `.from()` object audit | **No missing business tables/views found** | `documents` is a storage bucket reference, not a table |
| Production schema snapshot RLS | **84/84 public tables have RLS enabled** | Snapshot is dated 24 Nov 2026; policies still require review |
| SECURITY DEFINER source audit | **113 definitions, 0 missing pinned search_path** | Static migration-source scan, not a live database inspection |
| Environment example syntax | **No malformed assignments** | Does not prove production secrets are configured |
| Production build / full typecheck | **Not run** | Dependencies and pnpm were unavailable |
| PostgreSQL migration apply / SQL suites | **Not run in this workspace** | No psql, Docker, Supabase CLI or staging credentials |
| Playwright multi-role E2E | **Not run** | No installed project dependencies or authenticated staging accounts |
| Backup restore / payment gateway test | **Not run** | Requires external project credentials and isolated test systems |

## Corrections made in the source

### Authorization and tenant boundaries
- Removed hard-coded module-role restrictions that overrode valid granular permission grants. Kept role restrictions for role-specific landing pages and privileged screens.
- Added server-side API delegation so API handlers can return JSON 401/403 responses instead of middleware converting unauthenticated API requests into HTML login redirects.
- Hardened storefront tenant resolution: validated hostnames, bounded the in-memory cache and disabled default-organization fallback in production unless explicitly opted in.
- Removed the fixed default tenant from shared edge-function context.
- Removed tenant-admin access to global CRM automation fan-out functions.
- Disabled legacy public signup/demo endpoints that wrote to retired `tenants` / `staff_profiles` tables.

### Payment and storefront integrity
- Added a shared, idempotent storefront quote finalizer used by the browser confirmation and Razorpay webhook paths.
- Razorpay webhook tenant resolution now comes from the server-created checkout quote, not the incoming request host.
- Added payment-order, payment-ID and amount binding checks; duplicate callback handling; and retry-safe order creation through the quote ID idempotency key.
- Pickup and delivery quotes now store validated customer contact details, so pickup does not fail because `address` is null.
- Public checkout now blocks prescription-lens package orders until a prescription is persisted, approved by an optometrist and connected to the lab workflow. This is an intentional safety block, not a completed online lens-order feature.
- Mock WhatsApp delivery no longer reports a message as successfully sent when no provider is configured.

### Application/data-model corrections
- Fixed organization label lookup to use `organizations`.
- Reconnected Suppliers, Expenses, Loyalty and Consultations pages to canonical tables/views.
- Consolidated Quality Control and Dispensing onto existing Workshop and Sales workflows instead of maintaining duplicate inert screens.
- Replaced the misleading LPIMS inventory query with the actual lens package catalogue and explicit disclosure that power-level physical stock matching is not available in that screen.
- Removed Payroll from routine navigation and replaced fabricated payroll output with an explicit disabled state; the current schema does not provide a verified payroll-processing model.
- Corrected environment examples and Supabase seed configuration.
- Made seed organization/branch inserts repeat-safe and fixed JSONB finance seed values.
- Made three previously failing migration sections repeat-safe: purchase-order audit trigger, site-page policies/trigger and product-cost policies.
- Added storefront settlement guard tests.

### Forward security migration
Added `supabase/migrations/20261217000000_fix_schema_drift.sql` to fix live-policy drift that cannot be corrected by editing migrations already marked as applied:
- Tenant-scope public `site_pages` reads with `request_org()`.
- Restrict public review inserts to active products belonging to the current tenant.
- Prevent browser-supplied customer IDs and `verified_purchase=true` claims.
- Remove the public organization directory policy.

The public review form now submits unverified reviews without a client-asserted customer identity. Verified-purchase badges require a separate server-side purchase verification implementation.

## Confirmed live-production schema drift

The supplied `docs/sql/snapshots/prod.json` (24 Nov) compared with `upgrade.json` (after applying the repository migration set to an isolated upgrade copy) shows **16 tables present in the upgraded schema but absent from the live production snapshot**:

- `announcements`
- `billing_plans`
- `break_glass_grants`
- `catalogue_sample_templates`
- `checkout_quotes`
- `org_subscriptions`
- `platform_audit_logs`
- `platform_settings`
- `platform_users`
- `stock_audit_lines`
- `stock_audit_sessions`
- `subscription_events`
- `subscription_invoices`
- `subscription_payments`
- `subscription_usage`
- `support_tickets`

The same comparison shows **31 functions, 16 triggers, 26 policies and 55 grants** present in the upgraded schema but absent from the live snapshot, plus 50 definition differences. Important examples:
- Live `profiles.role_key` and `role_permissions.role_key` constraints only allow the older role set (`owner`, `admin`, `branch_manager`, `staff`); specialist roles in the current application are not yet represented in the live schema.
- Live `stock_movements.reason` does not include the `audit` reason required by the newer stock-audit workflow.
- `checkout_quotes` is absent, so the current quote-based online checkout/webhook finalizer cannot run against that live schema.
- Subscription billing and platform administration tables/functions are absent from the live snapshot.

This is a **deployment-blocking migration gap**, not a UI issue. Apply the full migration set to staging, reconcile the 16 missing tables and related functions/policies/triggers, run the SQL suites, then schedule the production migration window.

## P0 blockers — must pass before any commercial shop goes live

1. **Apply and verify database migrations on staging.** The supplied 24 Nov production snapshot shows the old unscoped `site_pages.sp_anon`, `product_reviews.reviews_insert WITH CHECK (true)` and public `organizations.org_anon` policy. The new forward migration corrects these in source, but it has not been applied to the live database.
2. **Run the complete SQL security suite.** This includes `supabase/tests/rls_audit.sql`, branch-access, role-model, subscription, break-glass and cross-tenant probes. The suite was extended with public page/review checks but was not executed here.
3. **Re-run upgrade migration application.** The supplied `docs/sql/upgrade-apply-results.json` recorded failures for:
   - `20261121030000_purchase_orders.sql`: existing `trg_po_audit`.
   - `20261125020000_site_pages.sql`: existing `sp_anon`.
   - `20261126020000_product_costs.sql`: existing `pc_sel`.

   The migration source has been made repeat-safe, but the database upgrade test must be rerun to prove it.
4. **Run production build and full typecheck** with the repository's locked pnpm dependencies.
5. **Run staging Playwright E2E** with separate shop A/shop B tenants and accounts for owner, admin, branch manager, optometrist, receptionist, sales executive, cashier, inventory manager, lab technician and accountant.
6. **Validate Razorpay in test mode**: captured payment, failed payment, webhook replay, browser closed after payment, amount mismatch, unknown quote, duplicate callback and reconciliation.
7. **Perform a real backup restore** into an isolated database and verify documents/storage recovery. A configured backup is not proof of a successful restore.
8. **Complete a supervised shop pilot** with parallel reconciliation before replacing the shop's existing ERP or billing process.

## Twelve business-module status

The table below separates implementation evidence from end-to-end proof. No module is marked fully verified merely because a page or migration exists.

| Module | Current assessment | Remaining production proof / work |
|---|---|---|
| A. Customers & CRM | Partial | Family-member workflows, branch attribution/transfer, duplicate-phone business policy and complete Customer 360; test concurrent duplicate creation and consent end-to-end |
| B. Eye examination & prescriptions | Partial | Run optometrist approval, expiry, corrections, Rx history and optical measurement tests; confirm all prescription fields are wired through UI, DB and lab |
| C. Frames & inventory | Partial | Verify stock count, reservations, atomic transfers, damaged/returned stock and concurrent sales against live DB |
| D. Lens catalogue / LPIMS / PALRE | Not production-complete | PALRE tables exist in the schema snapshot but app integration is not proven; implement and test exact/nearest power matching, eligibility, verified manufacturer data and actual per-power stock |
| E. POS, billing & payments | Partial | Verify split payments, refunds, returns, cash closing, GST edge cases and concurrency; public prescription-lens checkout is deliberately blocked pending approved-Rx integration |
| F. Orders & lab | Unverified E2E | Technician assignment, supplier receipt, lens power verification, QC fail/rework, remake, ready and delivery flows |
| G. Repairs & warranty | Unverified E2E | Warranty eligibility, repair parts, photos/consent, charge/refund and customer notifications |
| H. Procurement | Partial | Re-run PO/GRN/invoice/partial receipt/returns/supplier payment flows; migration apply and approval threshold tests |
| I. Finance & GST | Unverified E2E | Accountant reconciliation, CGST/SGST/IGST, ITC, bank reconciliation, cashbook, refunds/credit notes, period lock and month-end close |
| J. Staff, RBAC & Payroll | Partial | Unit RBAC passes; live RLS/direct API tests still required. Payroll is not implemented as a verified payroll engine and is hidden from navigation |
| K. Website & Customer Portal | Partial | Tenant-domain isolation, portal document authorization, online order synchronization and gateway recovery E2E; online lens orders remain blocked |
| L. System reliability & SaaS platform | Unverified E2E | Backup/restore, load/concurrency, outage recovery, monitoring, subscription lifecycle, break-glass and multi-tenant isolation |

## Historical report reconciliation

`docs/FINAL_PRODUCTION_READY_REPORT.md` claims 171/171 tests passed. That claim conflicts with `docs/PILOT_TEST_ROUND2.md`, which reports 19 PASS, 15 PARTIAL, 15 FAIL and 105 NOT TESTED, with modules F–L at zero executed tests. It also conflicts with the unchecked manual sign-off in `docs/SECURITY_PENTEST_CHECKLIST.md`.

The 171/171 report is therefore marked **superseded and not valid release evidence**. The original report has been retained for audit history.

## Deployment requirements

- Use a separate staging Supabase project and staging payment gateway credentials.
- Back up the database and object storage before migrations.
- Apply migrations in order; do not edit migration history or mark migrations applied manually to bypass failures.
- Confirm every shop's custom domain exists in `org_domains`. Production default-organization fallback is disabled by default.
- Configure server-only `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `DOC_LINK_SECRET`, OCR credentials and integration-health tokens. Never place service-role or webhook secrets in `NEXT_PUBLIC_*`.
- Configure Supabase Edge Function secrets and production schedules for subscription lifecycle / usage refresh where enabled.
- Verify storage bucket policies for prescriptions, customer documents and generated PDFs.
- Deploy only after CI, SQL tests, Playwright, security review and backup restore pass.

## Final Go/No-Go

**NO-GO for general commercial launch today.**

A limited supervised pilot may begin only after P0 items 1–7 pass in staging and a shop owner signs the pilot acceptance checklist. General paid onboarding requires a successful supervised pilot and closure of all critical/high findings.

No production database was changed by this audit. No live customer data was accessed or modified.
