# Website Studio ↔ Storefront: current capabilities and integration

**Date:** 27 November 2026
**Scope:** `apps/erp` Website Studio and `apps/web` storefront. Read-only audit plus fixes applied in this pass.

## 1. What the storefront homepage can show today

The homepage is registry-driven: `website_sections` rows (ordered by `display_order`) are looped over, and each known `key` selects a renderer in `apps/web/src/components/HomePageView.tsx`. `/` and `/store` use this same renderer.

| Section key | Renders | Data source |
|---|---|---|
| `hero` | Headline, badge, up to two CTAs, feature chips, image or video; multiple active rows become a carousel | `website_content` rows `main` / `slide_*` / `badge` / `feature_*`, section image |
| `category_card` | Four category tiles | `website_content` |
| `frame_finder` | Tab pills + section CTA | `website_content` |
| `shape_chip` / `lifestyle_chip` | Shape / lifestyle shortcut chips | `website_content` |
| `best_seller` / `top_sunglasses` | Bestselling product cards | `public_catalog` (`bestseller = true`) |
| `collection_banner` | Three gradient or image banners | `website_content` |
| `lens_type` | Six lens-type tiles | `website_content` |
| `lenses_guide` | Educational cards | `website_content` |
| `feature_card` | Parent cards with nested child rows | `website_content` (`parent_key`) |
| `stores` | Active branches with photo, Maps and WhatsApp links | `branches` |
| `promo` | Single promotion banner | `website_content` |
| `ugc` | Approved review tiles or manual CMS tiles + CTA tile | `product_reviews` / `website_content` |
| `whatsapp_cta` | Floating chat button | `website_content`, `public_site_settings` |

Four keys are chrome rather than page blocks: `announcement`, `site_logo`, `nav`, `footer` — loaded by `apps/web/src/lib/chrome.ts` into `Header` / `Footer`. Global surfaces also on every page: exit-intent coupon (`coupons`), analytics script (`org_settings.analytics_id`), compare bar, cart and wishlist.

**Not supported by the homepage renderer:** arbitrary/new section types, rich text or HTML blocks, forms/newsletter signup, blog/article feeds, dedicated testimonial blocks (reviews are the UGC source), pricing tables, embedded maps (`branches.map_embed` is unused), real tab filtering on `best_seller` / `frame_finder`, and a per-tenant fallback content set. Unknown keys render nothing.

## 2. What the Studio can author

| Studio route | Edits | Write path |
|---|---|---|
| `/website` | Homepage blocks, section registry/order/visibility, product flags, review approval, bulk image upload, live preview | Direct browser Supabase writes (RLS is the gate) |
| `/website/pages` | Enterprise pages, buying/size guides, category heroes, eye-consultation config | Server actions + direct browser updates |
| `/website/clinical` | Clinical service CRUD, publish/hide, order | Direct browser Supabase writes |
| `/website/coupons` | Storefront discount codes | Server actions with subscription gate |
| `/website` → **Choose Lens** | Choose-lens cards: labels, order, visibility, prescription/ADD rules | Direct browser writes to `website_lens_usage` (RLS is the gate) |

There is no draft/version workflow: publishing means toggling `website_sections.enabled`, `website_content.is_active`, `site_pages.is_active`, `clinical_services.is_active` or `coupons.is_active`.

Content form fields include section, stable key, parent key, title, subtitle, body, image/alt, icon, CTA(s), badge, gradient classes, related link, video URL, and validity window. Nav mega-menus are authored as JSON in a `nav` row's `body`; header shortcuts fall back to built-in defaults.

## 3. Integration data flow

```
ERP Studio ──writes──> Supabase (website_sections, website_content, site_pages,
                       clinical_services, coupons, org_settings, products)
                              │
                    anon reads scoped by RLS + host→org resolution
                              │
Storefront ──renders──> '/' and '/store' (revalidate = 0, fresh on every request)
```

- Tenant resolution: `x-site-host` → `org_domains` / `site_domains` → `default_org()` → `DEFAULT_ORG_ID` (`apps/web/src/lib/tenant.ts`).
- Preview: Studio builds `${NEXT_PUBLIC_WEB_URL}/?preview=1&k=${SITE_PREVIEW_KEY}&_=<nonce>`. Middleware validates the key and sets a trusted `x-site-preview` header; server loaders then bypass RLS **but scope every query to the current org**, so hidden rows are visible without cross-tenant leakage. With no `SITE_PREVIEW_KEY`, preview shows the public view.
- `valid_from` is enforced in the storefront queries because the anon RLS policy only checks `valid_until`.
- Changes to homepage/sections/pages appear on the next request; other catalog pages cache for 60 seconds.

## 4. Fixes applied in this pass

- `/` and `/store` now share one homepage renderer; the divergent 679-line duplicate is gone.
- Empty or unsafe CMS links fall back to real routes (`safeHref`), including the WhatsApp float and chrome links.
- Studio-authored nav mega-menu JSON takes priority over the hardcoded label map.
- Studio `cta2_label`, `cta2_link`, `link` and `video_url` are now exposed in the form; the hero renders multiple slides/video and collection banners render video.
- Preview is org-scoped and now covers chrome, custom pages and both homepage aliases; page routes are no longer cached for 60 seconds.
- `valid_from` is honoured by public queries.
- Analytics tab shows the configured provider/ID and links to settings instead of a placeholder.
- Clinical services studio is reachable from the ERP sidebar and the studio tab bar.
- Reserved slugs include all current storefront routes (`store`, `clinical-services`, `reset-password`, etc.).
- Tailwind safelists cover operator-entered gradients and ERP product-toggle colours.
- Footer "Track Order" points to `/track-order`; stale "Phase 5/6" code comments removed.

## 5. Choose-lens, coupons and checkout

### Choose-lens is now database-driven
`/website` → **Choose Lens** edits `website_lens_usage` (migration `20270102000000_storefront_checkout_compat.sql`). Operators control each card's label, description, icon, display order, visibility, default lens design and two flags that the storefront enforces:

- `requires_rx` — Non-prescription is the only built-in choice with this off.
- `requires_add` — Progressive, Readers and Bifocal require ADD power in **both** eyes; Single Vision and Non-prescription never show or accept ADD.

The configurator (`apps/web/src/components/LensConfigurator.tsx`) prefetches usage cards, lens packages and lens options as soon as the modal opens, so the later steps do not wait on a slow catalogue. Before the migration is applied, the storefront and Studio both use the same built-in fallback list; Studio shows a "Seed defaults" button.

### Coupons verify server-side and respect the org cap
`/api/coupon` reads the coupon with a service-role, org-scoped query (the old anon read could not see inactive/unlisted rows consistently), validates dates, minimum order, total uses and per-customer uses, and caps the discount at `sales.max_discount_pct` / legacy `max_staff_discount_pct` so `place_sale` cannot reject it later. The ERP coupon form now reads every `is_active` FormData value — the hidden `false` used to win over the checked `true`, which silently created inactive coupons.

### Cart → quote → sale
`/api/checkout` normalises both legacy single-line carts and the frame+lens items written by the configurator into valid quote lines; it re-checks catalogue prices, prescription completeness (including ADD), the coupon and the discount cap, then stores a signed quote. `/api/order-confirm` now sends the Rx snapshot, coupon id and discount to `place_sale`; a missing Rx returns a real error instead of the generic WhatsApp message. Both checkout error paths display the server's message.

`place_sale` accepts a service-supplied org for storefront calls, writes the Rx snapshot to the sale, creates ADD-aware lab orders, and records coupon use once per idempotency key.

### Product filters
All-products filters moved from a top toolbar to a sticky desktop sidebar (`ProductFilters.tsx` + `CatalogListing.tsx`). Mobile/tablet keeps the existing bottom sheet, sort control, active-filter chips and "show results" button.

## 6. Remaining limitations

- No SEO metadata editor; metadata is code-defined and sitemap/robots use a configured base URL.
- Clinical Homepage `site_pages` JSON (`clinical-home`) is not rendered as a bespoke landing page; `/clinical-services` uses its own page copy.
- Studio has no true draft/publish or audit/version history.
- Homepage fallback copy is global, not org-aware; a new tenant with no seeds renders sparse sections.
- Some seeded links (e.g. footer social links) still point to `#` until an operator replaces them.
