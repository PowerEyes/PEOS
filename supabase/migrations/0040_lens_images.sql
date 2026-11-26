-- 0040 — lens catalog images
-- Lens packages and lens options gain an `images` array so the website can
-- render a real product photo next to the details, features and pricing
-- instead of a placeholder emoji. Paths are public storage paths in the
-- existing `product-images` bucket (<org_id>/<uuid>.jpg), uploaded from the
-- ERP inventory forms (gallery or camera) exactly like product photos.

alter table lens_packages add column if not exists images text[] not null default '{}';
alter table lens_options  add column if not exists images text[] not null default '{}';

comment on column lens_packages.images is 'Public storage paths in product-images bucket: <org_id>/<uuid>.jpg';
comment on column lens_options.images  is 'Public storage paths in product-images bucket: <org_id>/<uuid>.jpg';
