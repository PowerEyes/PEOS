# Commercial readiness code changes

This archive contains the updated PowerOS source plus:
- `docs/POWEROS_COMMERCIAL_PRODUCTION_AUDIT.md`
- `docs/POWEROS_DEPLOYMENT_RUNBOOK.md`
- `docs/POWEROS_PILOT_ACCEPTANCE_CHECKLIST.md`

Key code areas changed:
- ERP RBAC, middleware, shell, and canonical Suppliers/Expenses/Loyalty/Consultations screens.
- CRM automation trigger removal and truthful provider configuration behavior.
- Storefront host-to-tenant resolution, quote finalization, Razorpay webhook and checkout safeguards.
- Edge-function tenant context and WhatsApp provider fail-closed behavior.
- Supabase seed configuration and idempotent seed scripts.
- Forward RLS migration `20261217000000_fix_schema_drift.sql` and expanded `supabase/tests/rls_audit.sql`.

Verification completed locally:
- 52 unit tests passed.
- 75 unique migration versions.
- 27 TypeScript/TSX files syntax-transpiled without errors.
- 60 sidebar/Quick Create route references; zero missing destinations.

Not executed:
- Full typecheck / Next.js production build.
- SQL migration apply and RLS database suites.
- Playwright against staging.
- Razorpay live/test gateway flow.
- Backup/restore test.
- Multi-shop 30-day pilot.

This package is a corrected pre-production candidate, not a production sign-off.

## Phase 1 — Design System & Shared Components (2026-11-25)
- Added shared design primitives: Button, Card, PageHeader, StatusBadge, LoadingState, EmptyState, ErrorState, Notice, Field.
- Exported primitives from the shared UI package.
- Improved ERP shell route labels, skip-to-content, main landmark, navigation aria state, and responsive content container.
- Updated ERP and public website global design tokens and foundational styles for accessible focus, responsive spacing, fields, tables, and reduced motion.
- Verification: existing ERP tests 52/52 pass; touched TS/TSX syntax 4/4 pass.
- Full framework build/typecheck and visual browser audit remain unverified because dependencies/browser tooling are not installed.

## Phase 2 — Core Daily Workflow Page Polish (2026-11-25)
- Added shared responsive module KPI grid.
- Added retryable data-load error UI.
- Added KPI summaries to Customers, Customer 360, Consultations/Eye Examinations, Prescriptions, POS/Sales, Inventory, Repairs and Website Order Fulfilment.
- Added query-error guard UI to Customers, Prescriptions, Sales, Inventory, Repairs and Website Order Fulfilment.
- Verified 14 changed/new TSX files syntax and 52 existing ERP tests pass.
- Full build/typecheck and live/browser acceptance remain pending because workspace dependencies and environment are unavailable.
- Detailed report: `docs/POWEROS_PHASE2_CORE_WORKFLOW_POLISH.md`.

## Phase 3 — Operations & Back Office UX pass
- Shared KPI summaries added to Workshop/Lab, Purchase Orders, Suppliers, Stock Audits, Transfers, Appointments, Finance dashboard, and GSTR-1.
- Reports route changed from redirect-only to a report navigation hub.
- GSTR-1 month selector default corrected to 1-based calendar month.
- Quality Control continues using the canonical Workshop/Lab workflow to avoid a second state machine.
- Syntax transpilation 9/9 files passed; existing tests 52/52 passed. Full build/typecheck/browser and staging tests remain pending.

## Phase 5 — Website & Customer Portal UX (2026-11-25)
- Added accessible responsive portal navigation and a shared portal page-header component.
- Improved storefront header drawer, active navigation states, keyboard/Escape behavior and search semantics.
- Improved catalog, search, product detail, cart and order-tracking error handling.
- Added portal KPI summaries and explicit data-unavailable states to dashboard, orders, appointments, prescriptions, repairs and warranty.
- No production DB migrations or production configuration changes.
- Verification: 141 TS/TSX files syntax-transpiled without errors; existing ERP tests 52/52 pass. Full typecheck/build/browser QA not run because dependencies/tooling are unavailable.

## Phase 6 — Clinical Website + Website Controller (2026-11-25)
- Replaced `/` with clinical-first homepage and moved existing storefront homepage to `/store`.
- Added unified Clinical Care / Optical Store / Patient Portal destinations to the global header.
- Added database-driven clinical service listing/detail routes and seeded six starter clinical service records per tenant.
- Added Website Controller clinical service CRUD, publishing, hiding, ordering and deletion.
- Added Clinical Homepage CMS seed/content editing through Pages & Guides and added page create/delete actions to Pages & Guides.
- Reused existing `/eye-test` booking flow.
- Added patient portal eye-examination list/detail routes using the existing examination table and customer-scoped access.
- Added Eye Examinations to portal navigation.
- Added migration `20261125030000_clinical_website.sql`.
- Syntax transpilation: 12 touched files passed. Typecheck, build, live migration, browser, responsive and RLS tests remain pending due to dependencies/environment not being installed.
- Detailed report: `docs/POWEROS_CLINICAL_WEBSITE_PHASE6.md`.
