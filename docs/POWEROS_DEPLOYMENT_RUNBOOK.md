# PowerOS Deployment & Release Runbook

## 1. Environments

Maintain separate:
- Local development
- Staging (separate Supabase project, storage buckets, Razorpay test keys)
- Production (live Supabase project, live Razorpay keys)

Never run a migration or destructive test against production as a substitute for staging.

## 2. Required environment variables

### ERP application
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_ERP_URL`
- `NEXT_PUBLIC_WEB_URL`
- `DOC_LINK_SECRET` (32+ random characters)
- `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN` (if OCR enabled)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `INTEGRATION_HEALTH_TOKEN`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public key ID only)

### Storefront application
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ERP_ORIGIN`
- `INTEGRATION_HEALTH_TOKEN`
- `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN` (if OCR enabled)

`DEFAULT_ORG_ID` is a development/single-tenant fallback only. In production multi-tenant deployments it is disabled unless `ALLOW_DEFAULT_ORG_FALLBACK=true` is deliberately set. Map every production hostname in ERP > Settings > Store Domains (`org_domains`).

## 3. Pre-deployment gates

1. Confirm the correct Git commit and clean release branch.
2. Restore the latest production backup into an isolated recovery project and verify data plus storage objects.
3. Apply all migrations to staging with the Supabase CLI linked to the staging project.
4. Run `supabase/tests/*.sql` suites, including `rls_audit.sql`, branch access, role model, subscriptions and break-glass.
5. Run `pnpm install --frozen-lockfile`.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:e2e` and `pnpm --filter @poweros/erp build` (plus storefront build).
7. Run Playwright against staging with two organizations and all supported roles.
8. Run Razorpay test-mode end-to-end payment tests and webhook replay tests.
9. Verify the system-health endpoint, integration-health checks, OCR health and WhatsApp provider credentials.
10. Obtain optometrist and accountant sign-off for clinical and GST/finance workflows.

## 4. Migration discipline

- Take a fresh database backup before migration.
- Apply migrations in version order; never edit the remote migration history manually to hide drift.
- Do not run seed/demo scripts against production.
- Confirm migration apply output has no errors.
- Run SQL security tests after every RLS, tenant, branch or permission change.
- Keep the migration source and schema snapshot in the same release commit.

## 5. Payment release checks

Use Razorpay test credentials first:
- Successful capture and browser confirmation.
- Browser closed after capture; webhook completes the order.
- Duplicate webhook and browser callback do not duplicate sale or stock movement.
- Wrong signature rejected.
- Amount/currency mismatch rejected.
- Payment ID replay against another order rejected.
- Failed payment does not create a paid sale.
- Unmatched captured payment is visible to operations for reconciliation.

The public prescription-lens checkout is intentionally blocked until approved prescription persistence and lab fulfilment are integrated.

## 6. Backup and restore

Configure managed database backups / point-in-time recovery according to the Supabase project plan. Also protect Storage buckets containing prescription images, customer documents and generated PDFs.

At least once before launch:
- Restore database backup to a separate project.
- Restore or verify object storage separately.
- Check customer, prescription, sale, payment, stock, audit and document relationships.
- Verify the restored application can log in and open a sample customer/order.
- Record achieved recovery point and recovery time.

A backup schedule without a successful restore test is not accepted as recovery readiness.

## 7. Pilot release

- Select one consenting optical shop.
- Use a dedicated organization and isolated production-like tenant.
- Import only agreed, permissioned data.
- Run the old billing process in parallel at first.
- Reconcile daily sales, receipts, cash, UPI, refunds, stock and pending lab jobs.
- Record incidents and stop the pilot for any cross-tenant, prescription, payment or stock-integrity issue.
- Expand only after at least 30 days of successful supervised operation and signed owner/accountant/optometrist acceptance.

## 8. Rollback

- Keep the previous application release deployable.
- Prefer forward-fix migrations; do not drop or rewrite customer data to roll back an application.
- For schema changes, use additive migrations and a documented data recovery plan.
- If payment or stock integrity is uncertain, pause affected writes and reconcile before reopening.
