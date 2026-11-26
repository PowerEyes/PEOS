# Power Eyes Clinical Website + Website Controller — Phase 6

## Delivered

- Repurposed public `/` as the clinical-first homepage.
- Moved the existing storefront homepage implementation to `/store`; existing product/category/store routes are retained.
- Added a persistent unified destination navigation for Clinical Care, Optical Store and Patient Portal (desktop and mobile).
- Added database-driven `/clinical-services` listing and `/clinical-services/[slug]` detail template.
- Added starter service records (comprehensive examination, pediatric examination, myopia management, contact lens assessment, binocular vision assessment and follow-up) seeded per organization.
- Added ERP Website Controller `/website/clinical` with service CRUD, publish/hide, ordering and deletion.
- Clinical Homepage content is managed in ERP Website Controller → Pages & Guides → Clinical Homepage. Its structured JSON fields support hero copy, CTAs, highlights and closing section.
- Added page CRUD (create/edit/publish/hide/delete) to Pages & Guides.
- Reused existing eye-test booking flow at `/eye-test` (no duplicate booking flow).
- Added Patient Portal `/my/eye-examinations` and `/my/eye-examinations/[id]`, reading existing `eye_examinations` records filtered by authenticated customer ID and RLS.
- Added Eye Examinations to the shared patient portal navigation.
- Added migration `20261125030000_clinical_website.sql` for tenant-scoped clinical services, RLS, indexes, starter service rows and editable Clinical Homepage CMS content.

## Files/routes added or changed

- `apps/web/src/app/page.tsx` — clinical homepage
- `apps/web/src/app/store/page.tsx` — existing storefront homepage relocated
- `apps/web/src/app/clinical-services/page.tsx`
- `apps/web/src/app/clinical-services/[slug]/page.tsx`
- `apps/web/src/app/my/eye-examinations/page.tsx`
- `apps/web/src/app/my/eye-examinations/[id]/page.tsx`
- `apps/web/src/components/Header.tsx`
- `apps/web/src/lib/portal-nav.ts`
- `apps/erp/src/app/(app)/website/clinical/page.tsx`
- `apps/erp/src/app/(app)/website/clinical/view.tsx`
- `apps/erp/src/app/(app)/website/pages/view.tsx`
- `apps/erp/src/app/(app)/website/view.tsx`
- `supabase/migrations/20261125030000_clinical_website.sql`

## Verification

- TypeScript/TSX syntax transpilation: **12 touched files passed**.
- Full TypeScript typecheck: **not run** (project dependencies are not installed in this workspace).
- Next.js production build: **not run**.
- Browser route / responsive QA: **not run**.
- Migration execution and live Supabase RLS tests: **not run**.
- Appointment booking remains the existing `/eye-test` WhatsApp-based flow; no new booking backend was added.

## Apply before running

1. Apply migration `20261125030000_clinical_website.sql` to the target Supabase database.
2. Install dependencies from the repository lockfile.
3. Run ERP and website typechecks/builds.
4. Test the public tenant domain and a second tenant to validate `request_org()` isolation.
5. Test Website Controller service CRUD with admin and non-admin roles.
6. Test patient examination list/detail with customer A and customer B; confirm cross-customer access is denied.
7. Test Clinical homepage, `/store`, all service detail links, and booking flow on desktop/tablet/mobile.

**Status: source implementation delivered; not production-approved until migration and runtime QA are completed.**
