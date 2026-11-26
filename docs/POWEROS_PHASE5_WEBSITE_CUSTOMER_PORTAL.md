# Phase 5 — Website & Customer Portal Experience Upgrade

**Status:** Source implementation delivered; production acceptance remains pending.

## Scope

- Website navigation and content experience
- Product discovery and category/catalog listing
- Product details
- Search and filters
- Cart and checkout
- Order tracking
- Customer dashboard
- Prescriptions
- Repairs
- Appointments
- Warranty
- Loyalty

## Implemented in this pass

### Navigation and shared customer-account shell
- Added `PortalNav` with route-aware active states, accessible current-page indication, responsive desktop/mobile behavior, and consistent navigation spacing.
- Added skip-to-account-content link and focusable main landmark.
- Improved storefront header mobile drawer semantics (`dialog`, modal, label, close label), Escape-to-close, and background scroll lock while open.
- Added active route treatment to desktop and mobile storefront links.
- Mega-menu can be opened through keyboard focus as well as pointer hover.
- Search inputs now expose labels, combobox semantics and controlled listbox IDs.

### Shared portal page presentation
- Added `PortalPageHeader` for consistent page title, explanatory description, eyebrow and action layout.
- Adopted it on Orders, Appointments, Prescriptions, Repairs, Warranty and Loyalty.
- Added live-data KPI cards on Repairs, Warranty, Appointments and Prescriptions.

### Product discovery, search, filters and product detail
- Catalog listing now distinguishes a catalog query failure from a valid empty catalog and displays a retry-oriented notice instead of presenting an outage as no products.
- Search input is sanitized and bounded before constructing PostgREST filter expressions.
- Search page reports search failure distinctly from zero results.
- Header autocomplete sanitizes and bounds search text, handles request exceptions, and clears suggestions on failed queries.
- Filter drawer supports Escape close, modal semantics and explicit accessibility labeling.
- Product detail now distinguishes loading from unavailable/error state, provides a retry action, and does not leave failed product queries in an indefinite skeleton state.

### Cart and checkout / order tracking reliability
- Coupon response parsing now tolerates a non-JSON response and falls back to error feedback.
- Removed an inaccurate cart reassurance that claimed the customer's prescription was saved; replaced with neutral prescription guidance wording.
- Order tracking validates the 10-digit registered phone number, clears stale result before a new request, uses no-store fetch, reports errors with alert semantics and resets the busy state through `finally` even on failure.

### Customer portal data states
- Customer dashboard now detects metric-query errors and warns when metrics may be incomplete rather than silently implying every KPI is accurate.
- Orders, Appointments, Prescriptions, Repairs and Warranty now distinguish query errors from an empty history.
- Prescription validity follows the record status and treats missing expiry as valid only when the prescription is marked active; added total/active/expiring-soon/expired metrics.
- Appointments added total/upcoming/completed/cancelled-or-no-show summary metrics using local date.
- Repairs added total/in-progress/ready/overdue metrics based on loaded customer-scoped records.
- Warranty added record/active/expired summary metrics based on the existing warranty calculation.

## Reliability and security notes
- Search query syntax is restricted to letters, digits, whitespace, underscore and hyphen, and bounded to 60 characters before it is inserted into PostgREST OR filters.
- Customer portal queries remain scoped by the authenticated customer identity and existing customer_id filters; no new master-data tables or business logic were introduced.
- Existing checkout/payment and prescription-lens restrictions are preserved. Online prescription lens checkout remains intentionally blocked until the approved prescription and fulfillment workflow is integrated.
- Warranty calculation and policy claims are existing business assumptions and still require business-owner confirmation against the actual warranty policy.
- No production database, payment gateway or tenant configuration was changed.

## Verification performed
- TypeScript/TSX syntax transpilation: **141 source files, 0 syntax errors**.
- Existing ERP test suite: **52/52 passed**.
- ZIP integrity verification: passed after packaging (archive tested with `unzip -t`).

## Not performed / release blockers
- Full `pnpm typecheck` (pnpm and dependencies unavailable in the workspace).
- Next.js production build.
- Browser visual testing or screenshots.
- Keyboard/screen-reader accessibility test with a real browser.
- Responsive QA at desktop/tablet/mobile widths.
- Staging database and RLS testing.
- End-to-end shopping, checkout, payment, order tracking and customer-account workflows.

## Acceptance decision

**Phase 5 source changes are delivered, but not production-ready / launch-approved.** The remaining verification requires installing the locked dependencies and using a staging deployment with configured Supabase, Razorpay test credentials, tenant data and browser automation.
