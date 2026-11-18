-- 0027: branch photo + Google Maps embed for branches
--
-- image_path / image_alt — public storage path (+ alt text) in the existing
--              `site-images` bucket (<org_id>/<uuid>.jpg), uploaded via the ERP
--              ImageField. The website homepage's stores section and the store
--              locator already read these columns.
-- map_embed  — a VALIDATED Google Maps embed URL (https://www.google.com/maps…).
--              The ERP normalises whatever the admin pastes (embed <iframe> HTML,
--              a Maps link, or a plain address) down to a single URL before saving,
--              so raw HTML is never stored or rendered.

alter table branches add column if not exists image_path text;
alter table branches add column if not exists image_alt  text;
alter table branches add column if not exists map_embed  text;
comment on column branches.image_path is 'Public storage path in site-images bucket: <org_id>/<uuid>.jpg';
comment on column branches.image_alt  is 'Alt text for the branch photo';
comment on column branches.map_embed  is 'Validated Google Maps embed URL (https://www.google.com/maps…); never raw HTML';
