# Power Eyes Phase 7 — Clinical Homepage & CMS Routes

## Delivered
- Rebuilt `/` as the Clinical Homepage based on the provided Power Eyes screenshot, with responsive layout, hero/CTA, clinical-service cards, clinical technology panel, Optical Store panel, appointment and patient-portal panels, brand band, and branch listing.
- `/` reads `site_pages` record slug `clinical-home` and `clinical_services` from Supabase using the resolved organization. Branch cards are sourced from active branches.
- Clinical homepage editable fields are stored in the existing Pages & Guides CMS record (`site_pages` slug `clinical-home`) and are editable through ERP Website Controller > Pages & Guides. The body JSON supports hero eyebrow/title/subtitle/CTA links, highlights, service heading, clinical panel, store panel, appointment panel, and portal panel. Hero image uses the CMS image field.
- Existing optical store route `/store` remains available and is linked from the Clinical Homepage.
- Added database-driven guide routes: `/guide-eyeglasses`, `/guide-sunglasses`, `/guide-contact-lenses`, `/guide-computer-glasses`, `/guide-lenses`. These render `site_pages` content through `ContentPage` and are editable in Pages & Guides.
- `ContentPage` now renders optional guide tables from CMS body (`table.headers`, `table.rows`), in addition to sections and FAQs.
- Existing listing page hero configuration remains DB-driven via `hero-eyeglasses`, `hero-sunglasses`, `hero-contact-lenses`, `hero-computer-glasses`, and `hero-lenses` CMS records and the shared `CatalogListing` component.
- Existing website-controller CRUD for Pages & Guides remains the CRUD source: create, edit, publish/hide, delete, content sections, image, guide tables, structured JSON, ordering. No separate duplicate CMS was added.

## Database/CMS slugs required
- `clinical-home`
- `guide-eyeglasses`
- `guide-sunglasses`
- `guide-contact-lenses`
- `guide-computer-glasses`
- `guide-lenses`
- `hero-eyeglasses`
- `hero-sunglasses`
- `hero-contact-lenses`
- `hero-computer-glasses`
- `hero-lenses`

The Pages & Guides controller should create or edit missing CMS entries. The frontend intentionally returns not-found for inactive/missing standalone content pages rather than silently inventing a duplicate page record.

## Verification performed
- TS/TSX transpilation syntax check for all changed/new files.
- ZIP integrity check.
- Full Next build, database integration, and browser QA were not run in this environment.
