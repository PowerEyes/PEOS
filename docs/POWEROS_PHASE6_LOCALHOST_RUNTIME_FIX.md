# Phase 6 Localhost Runtime Fix

## Issues addressed

1. `No organization is mapped to host "localhost"` crashed the Clinical Homepage when a local host had no `org_domains` mapping and no `DEFAULT_ORG_ID`.
2. Next.js metadata warning for `themeColor`.
3. `/sw.js` 404 request.

## Changes

- Clinical Homepage now catches tenant-resolution failure and renders a tenant-independent static clinical landing page. Tenant-specific CMS/service/branch data is still only loaded after a valid organization resolves; no arbitrary tenant is selected and production tenant resolution remains fail-closed.
- Moved `themeColor` from `metadata` to Next.js `viewport` export.
- Added minimal `public/sw.js` pass-through service worker; it deliberately does not cache authenticated, portal, ERP, or clinical data.

## Verification

- ZIP integrity check passed.
- Full typecheck, Next.js production build, and browser QA were not run in this environment.

## Setup note

For full tenant-specific CMS content on localhost, configure a valid `DEFAULT_ORG_ID` in the local web app environment or map `localhost` in `org_domains`. The static fallback prevents the homepage from crashing while preserving tenant isolation.
