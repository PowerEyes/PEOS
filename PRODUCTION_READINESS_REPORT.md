# PowerOS multi-org / multi-branch — gap report & production readiness

**Verification status: NOT executed.** The sandbox had no network, no Postgres, no `packages/*` (the zip omits `@poweros/ui` and `@poweros/business-rules`), so `next build`, migrations and tests could not be run. Everything below is implemented but unverified until you run the steps in "Deployment".

## Gaps found → status
| # | Sev | Gap | Fix |
|---|-----|-----|-----|
| 1 | Critical | Views `customer_orders`, `itc_summary`, `customer_loyalty_balance` ran as owner and are granted to `authenticated`: any logged-in user (incl. website customers) could read every tenant's orders/finance | `security_invoker = true` |
| 2 | Critical | No branch scoping anywhere; RLS was org-only | `can_access_branch()`, restrictive `branch_scope` policy + `enforce_branch_scope` trigger on every table with `org_id`+`branch_id`; `sale_lines` inherits parent |
| 3 | Critical | SECURITY DEFINER `cancel_order`, `deliver_order`, `create_credit_note`, `advance_lab_orders` bypass RLS (cross-branch writes) | Covered by the trigger (auth.uid() still the caller) |
| 4 | High | `profiles` had no UPDATE policy, so the Staff page (approve/role/branch/deactivate) could not work through RLS, and pending signups (org null) were invisible to admins | Replaced by RPCs `approve_staff`, `set_staff_role`, `set_staff_branches`, `set_staff_active`; direct writes revoked |
| 5 | High | Deactivation relied on UI flipping `is_approved`; `current_org()` ignored `deactivated` | `current_org()`/`is_admin()` check `not deactivated` |
| 6 | High | Roles only staff/admin/owner; admin could edit owners; no last-owner protection; no self-change guard | owner, admin(Company Admin), branch_manager, staff; hierarchy + last-owner + self-change guards in `_staff_guard` |
| 7 | High | Invitations were a no-op message | `staff_invitations` + `invite_staff`; org assigned only from a matching invite (never client metadata); approval requires verified email + branch |
| 8 | High | `next_code(p_org…)` let staff bump another org's counters | org check |
| 9 | Med | No cross-branch transfers | `stock_transfers` (+lines), request → approve/dispatch (source manager/admin, not requester) → receive (destination); exact-once stock movements |
| 10 | Med | No temporary assignments | `user_branches` with expiry; `grant_temp_branch` (admin ≤365d, manager ≤30d, own branch, staff only, reason required), `revoke_branch_access` |
| 11 | Med | Audit only on a few tables, mutable | audit on profiles, user_branches, invitations, transfers; `audit_log` append-only |
| 12 | Med | Customers: shared identity | Already org-wide with permanent code/Vision ID; kept. Phone intentionally not unique (shared family numbers) |

## Compatibility decisions (review)
- Backfill: legacy staff with no branch (old "All branches") get explicit `user_branches` rows for every active branch, so nobody is locked out. Tighten in /staff.
- Role check constraint is `NOT VALID`: old rows untouched, new writes enforced.
- Uninvited staff "Request access" signups now stay unapproved and are invisible to every org's admins (prevents cross-tenant exposure). Admins must invite first.
- Staff UI: approve needs a branch; role list gains `branch_manager`.

## Remaining blockers / not done
1. Run build, migrations and `supabase/tests/multi_branch_rbac.test.sql` (never executed; expect some fixes).
2. `sync_auth_to_customer` still hardcodes org `…0001` for website customers: true multi-org needs the public site to resolve its org (domain/setting).
3. Role-based table permissions (e.g. plain staff blocked from finance/cashbook/purchase tables) not applied: needs a permission matrix and testing, since invoker RPCs like `place_sale` write those tables.
4. Child tables without `branch_id` other than `sale_lines` (lab/payment lines etc.) are org-scoped only: audit with `\d` and add parent-inherited policies.
5. Storage: buckets are org-scoped by path; per-branch storage paths are not enforced. Private-bucket policies should be reviewed for branch folders.
6. Transfer UI pages are not built (RPCs and tests exist). Temporary-assignment UI: server actions exist (`grantTempBranch`, `revokeBranchAccess`), no screen.
7. Partial transfer receipts and cancelling in-transit transfers unsupported.
8. `/api` routes and web customer app were not reviewed in depth; exports run through RLS-protected queries.

## Deployment
1. Back up; apply `20261122000000_multi_branch_rbac.sql` to staging first.
2. `psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_branch_rbac.test.sql`
3. `pnpm install && pnpm --filter @poweros/erp build` (needs the omitted `packages/*`).
4. Confirm each existing staff user's branches in /staff; confirm at least one active owner per org.
5. Set `SUPABASE_SERVICE_ROLE_KEY` (server only) to enable invitation emails; Supabase Auth: require email confirmation.
6. Verify customer portal (/my orders, loyalty) after the view change.

---
# Update: hardcoding removal & finance permissions (migration `20261122010000_org_driven_permissions.sql`)
Still **not executed** (no Postgres/network here). Apply both new migrations in order, then run the extended SQL test file.

## Done
- **Tenant resolution from the DB:** `site_domains` + `resolve_org(host)`/`default_org()`/`request_org()`. A single-organisation install auto-registers its only org as default. Multi-org: insert one `site_domains` row per hostname.
- **Public (anon) reads are tenant-scoped in Postgres:** every anon/public SELECT policy on an `org_id` table is rewritten to `org_id = request_org()`; `public_catalog` and `public_site_settings` views likewise. The site sends its host in `x-site-host` (server + browser Supabase clients). Fixes the cross-tenant exposure from `branches_anon` etc.
- **Removed every runtime `ORG` UUID** from ERP (8 files, now RLS/`current_org()` defaults), web (cart, reviews, referral, checkout, webhook, customer linking) and edge functions (cron jobs fan out per organisation; `order-whatsapp` takes the org from the order; WhatsApp log org from the customer).
- **Hardcoded city/state/pincode** (`Chennai / Tamil Nadu / 600037`): now `org_settings` keys `default_city|default_state|default_pincode` (backfilled from each org's own most common customer values), used by the signup trigger, column defaults, web checkout/profile and ERP customer forms. GSTR-1 no longer defaults to state code 33.
- **Finance permissions are data:** `permission_catalog` + per-org `role_permissions`; `has_permission()`; owner-only `set_role_permission()` (audited). Enforced by write triggers (also blocks SECURITY DEFINER paths) and restrictive read policies on expenses, day closings, GST periods, suppliers, purchase invoices/items, credit notes, cashbook. Defaults: branch_manager gets finance.view, expenses, purchases, credit notes; staff gets none; owner/admin always full.

## Behaviour changes to check
- Plain staff can no longer open finance/purchase/expense data or issue credit notes: grant via `set_role_permission` if your shop wants that.
- New-signup website customers are only auto-created when the tenant is unambiguous (site metadata `org_id` or a default site); otherwise linked at login via `resolve_org`.
- Dashboards that read cashbook/expenses will show empty for staff without `finance.view`.

## Still hardcoded / remaining
1. Brand copy in web pages is Power Eyes-specific: `layout.tsx` metadata, `about`, `contact`, `terms`, `privacy`, `faq`, `offers`, `print/rx`, `lib/chrome-data.ts` (Mogappair/Chennai text and address). Move to the existing CMS/`website_content` + `org_settings` per org; I did not rewrite them for budget.
2. `supabasePreview` uses the service role (bypasses RLS) so draft preview shows all orgs.
3. Old seed migrations (0009/0013/0023/0026) still insert Power Eyes content for the original org id: they are historical seed data; new orgs start empty.
4. No admin UI yet for `site_domains`, org defaults or the permission matrix (RPCs/tables exist; use SQL or build a Settings screen).
5. Static India state dropdown lists remain (reference data, not tenant data).
6. Unverified: view redefinitions (`public_catalog` copied from 0024), anon policy rewrite, and ERP form hooks need a build + staging run.
