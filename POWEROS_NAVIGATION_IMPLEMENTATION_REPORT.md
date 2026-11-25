# PowerOS Navigation Shell — Implementation Report

## Scope completed

Updated the authenticated PowerOS ERP shell in the supplied `PEOS-main` repository.

### Existing architecture audited
- The ERP is a **Next.js 14 App Router** application, not a Vite SPA. The authenticated shell is provided by `src/app/(app)/layout.tsx` and `src/components/Shell.tsx`.
- Authentication is Supabase SSR (`auth.getUser()`); the app layout loads the profile, `my_permissions`, tenant name, branches and branch scope.
- Direct-route enforcement is in `src/middleware.ts`, using `routeAllowed()` and the server-side `my_permissions` RPC.
- Branch context is cookie-backed by `resolveScope()` and changed through the existing `BranchSwitcher` action.
- Platform administration is a separate authorization boundary in `src/app/platform/layout.tsx`, guarded by `requirePlatform()` against `platform_users`. It is not a tenant role in the ordinary profile RBAC system.

## Implemented

- Rebuilt `Shell.tsx` as a compact dark-navy, orange-accented enterprise shell.
- Added grouped navigation for dashboard, customers/CRM, clinical, sales, inventory, procurement, workshop/lab, finance, staff/payroll, customer engagement, branches, reports, website, settings/security and subscription.
- Navigation items are linked only to routes that exist in the repository. No placeholder pages were created for missing routes.
- Active route styling, active parent groups, expandable groups, collapsed desktop sidebar, tooltips, mobile slide-in drawer, keyboard focus states and Escape-to-close behavior.
- Sidebar collapse state persists in local storage.
- Breadcrumbs and page title derive from the current pathname.
- Branch selector remains connected to the existing branch-scope action and is available in the sidebar and top bar at wider breakpoints.
- Quick Create links use existing customer, sales, appointment, prescription, purchase, repair and expense workflows.
- Global search continues to use the existing authenticated Supabase browser client and customer RLS; its UI now accurately describes the available search scope (customer records and permitted page shortcuts). Filter input is constrained before composing the PostgREST search expression.
- Notifications open the existing database-backed Inbox & Alerts page.
- Added a server-computed pending transfer approval count, scoped to the active branch when applicable, and show it only to owner/admin users or users granted `transfers_approve`.
- Added server-side role landing redirects for the configured tenant roles.
- Added route aliases for requested landing paths that did not previously exist. They reuse existing dashboard, appointment, sales/POS and workshop screens; they do not introduce duplicate business logic.
- Extended shared `routeAllowed()` rules for the role-specific landing routes and operational module boundaries. Existing permission checks remain in place.
- Footer now shows PowerOS, tenant context, app version, Help & Support and a restrained application indicator.

## Route audit

- Audited the route tree under `src/app/(app)`.
- The final sidebar and Quick Create route references were checked against actual `page.tsx` routes: **no missing references**.
- The existing Consultation and LPIMS pages were found and reused.
- Routes for inventory display/options/packages were not present, so no fake menu destinations or placeholder screens were added.
- Detail/action/public routes remain out of the sidebar.
- Platform Administration remains in its existing separate platform shell and retains its `platform_users` server guard.

## Files changed

- `apps/erp/src/components/Shell.tsx`
- `apps/erp/src/components/CommandPalette.tsx`
- `apps/erp/src/lib/rbac.ts`
- `apps/erp/src/middleware.ts`
- `apps/erp/src/app/(app)/layout.tsx`
- Added role landing aliases under `apps/erp/src/app/(app)/`:
  - `owner-dashboard`
  - `branch-dashboard`
  - `employee-dashboard`
  - `optometrist`
  - `receptionist`
  - `sales/pos`
  - `cashier`
  - `lab-tech`
  - `owner-dashboard/branch-comparison`
  - `owner-dashboard/branch-inventory`

## Verification and limitations

- Static route-reference audit: **passed** (no missing sidebar/Quick Create routes).
- Runtime build, TypeScript validation with project dependencies, browser interaction testing and multi-role Playwright testing could **not** be completed in this environment because the extracted repository has no installed `node_modules`, no `pnpm` executable and no runtime Supabase environment credentials.
- The global `tsc` command was attempted but cannot validate the project without its declared React, Next.js, Supabase and workspace package dependencies; its output is dominated by missing-module/type errors.
- Existing Node test files were attempted. They import TypeScript source directly and fail under the available bare Node test runner because no TypeScript loader/dependencies are installed.
- The Inbox page supplies database-backed alert lists, and the top-bar badge is backed by a server-side transfer count. A unified notification center/table and counts for every alert category were not present in the audited schema/code paths, so those were not invented.
- Search currently searches customer records plus permitted navigation shortcuts; product, prescription, order, invoice and employee entity search are not implemented by the existing search backend and were not falsely presented as working.
- Privacy and Terms routes were not present in the app route tree. The footer links to the existing Help & Support route rather than creating placeholder legal pages.
- No claim is made that the app has passed production acceptance or cross-role browser QA. Install dependencies, configure staging Supabase, then run `pnpm --filter @poweros/erp typecheck`, `pnpm --filter @poweros/erp build` and the ERP Playwright suite with owner, admin, branch manager, optometrist, receptionist, sales executive, cashier, lab technician and accountant test accounts.

## Important security note

The shell's menu filtering is a usability layer. The authoritative access controls remain Supabase RLS/RPCs and the server middleware. Any page whose data/actions are not protected by those server/database controls still needs a separate security review before production.
