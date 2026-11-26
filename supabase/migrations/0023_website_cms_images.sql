-- ── 0023: Website CMS foundation — sections registry + image upload ──────────
-- (numbered 0023 because 0022_conversion_features.sql already claimed 0022)
--
-- Phase 1 of the "every block is controllable from the Website Controller"
-- work. Today only 1 of the 19 homepage blocks is editable (collection_banner),
-- and even that one cannot carry an image.
--
-- Part 1 — website_sections: one row per homepage block, so a whole section can
--          be hidden (enabled) and reordered (display_order), and can carry its
--          own heading / subheading / background image.
-- Part 2 — website_content gains key, icon, image_alt, parent_key and a second
--          CTA pair. `image_path` and `video_url` already existed (0009) but
--          were never exposed by the ERP form nor read by the site.
--          Also adds the MISSING delete policy: the ERP's "Delete" button has
--          been silently no-op'ing because 0009 only created select/insert/
--          update policies.
-- Part 3 — branches gains image_path / image_alt so store cards can show a photo
--          instead of the 🏪 emoji.
-- Part 4 — public `site-images` bucket for CMS imagery, at <org_id>/<uuid>.jpg,
--          same shape as product-images (0003) but write/delete gated on
--          is_admin() to match the wc_write policy.
-- Part 5 — seed all 18 section rows.
-- Part 6 — seed / tag every content row so the site renders byte-identically
--          once Phase 4 starts reading from the DB.
--
-- Idempotent: every CREATE is guarded, every seed uses ON CONFLICT.

-- ── Part 1: website_sections ─────────────────────────────────────────────────
create table if not exists website_sections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default public.current_org() references organizations(id),
  key           text not null,          -- 'hero','category_card','nav','footer',…
  title         text,                   -- section heading
  subtitle      text,                   -- section subheading
  image_path    text,                   -- section-level image (logo, hero bg, …)
  image_alt     text,
  bg_color      text,                   -- tailwind gradient classes
  cta_label     text,                   -- section-level "View All" link
  cta_link      text,
  enabled       boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz default now(),
  unique (org_id, key)
);
create index if not exists website_sections_order on website_sections (org_id, enabled, display_order);

alter table website_sections enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='ws_anon') then
    create policy ws_anon on website_sections for select to anon using (enabled);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='ws_staff') then
    create policy ws_staff on website_sections for select using (org_id = public.current_org());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='ws_write') then
    create policy ws_write on website_sections for insert with check (org_id = public.current_org() and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='ws_update') then
    create policy ws_update on website_sections for update using (org_id = public.current_org() and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='ws_delete') then
    create policy ws_delete on website_sections for delete using (org_id = public.current_org() and public.is_admin());
  end if;
end $$;

-- ── Part 2: website_content columns + missing delete policy ──────────────────
alter table website_content
  add column if not exists key         text,   -- stable id within its section
  add column if not exists icon        text,   -- emoji fallback when no image
  add column if not exists image_alt   text,   -- accessibility / SEO
  add column if not exists parent_key  text,   -- grouping (tile → card, link → column)
  add column if not exists cta2_label  text,   -- second CTA (hero has two)
  add column if not exists cta2_link   text;

-- Keeps seeds idempotent: keys are unique inside a section. Deliberately NOT a
-- partial index — ON CONFLICT (org_id, section, key) can only infer a partial
-- index if the predicate appears in the statement, and plain inserts have no
-- WHERE clause. Postgres treats NULLs as distinct, so pre-existing rows that
-- have no key yet remain unaffected.
create unique index if not exists website_content_key_uniq
  on website_content (org_id, section, key);
create index if not exists website_content_parent
  on website_content (org_id, section, parent_key, display_order);

-- 0009 created only select/insert/update — the ERP delete button therefore
-- matched zero rows and reported success. Add the missing policy.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='wc_delete') then
    create policy wc_delete on website_content
      for delete using (org_id = public.current_org() and public.is_admin());
  end if;
end $$;

-- ── Part 3: branches images ──────────────────────────────────────────────────
alter table branches
  add column if not exists image_path text,
  add column if not exists image_alt  text;

-- ── Part 4: site-images bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('site-images', 'site-images', true) on conflict do nothing;

do $$
begin
  -- Public read: these render on the marketing site for anonymous visitors.
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='simg_read') then
    create policy simg_read on storage.objects for select using (bucket_id = 'site-images');
  end if;
  -- Write/delete: own org folder AND admin, matching wc_write on website_content.
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='simg_write') then
    create policy simg_write on storage.objects for insert with check (
      bucket_id = 'site-images'
      and (storage.foldername(name))[1] = public.current_org()::text
      and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='simg_del') then
    create policy simg_del on storage.objects for delete using (
      bucket_id = 'site-images'
      and (storage.foldername(name))[1] = public.current_org()::text
      and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and policyname='simg_upd') then
    create policy simg_upd on storage.objects for update using (
      bucket_id = 'site-images'
      and (storage.foldername(name))[1] = public.current_org()::text
      and public.is_admin());
  end if;
end $$;

-- ── Part 5: seed the 18 section rows ─────────────────────────────────────────
-- display_order follows the visual order of the live homepage.
insert into website_sections (org_id, key, title, subtitle, enabled, display_order) values
  ('00000000-0000-0000-0000-000000000001','announcement',   null,                                                                                null,   true,  1),
  ('00000000-0000-0000-0000-000000000001','site_logo',      null,                                                                                null,   true,  2),
  ('00000000-0000-0000-0000-000000000001','nav',            null,                                                                                null,   true,  3),
  ('00000000-0000-0000-0000-000000000001','hero',           null,                                                                                null,   true,  4),
  ('00000000-0000-0000-0000-000000000001','category_card',  null,                                                                                null,   true,  5),
  ('00000000-0000-0000-0000-000000000001','frame_finder',   'Find Your Perfect Frame',                                                           'Explore by shape, face shape, lifestyle or need', true, 6),
  ('00000000-0000-0000-0000-000000000001','best_seller',    'Best Sellers',                                                                     'Most loved frames by our customers',            true,  7),
  ('00000000-0000-0000-0000-000000000001','collection_banner', null,                                                                             null,   true,  8),
  ('00000000-0000-0000-0000-000000000001','lens_type',      'Smarter Vision Starts Here',                                                       'Specialised lenses for how you live today',     true,  9),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip', 'Frames for Your Life',                                                             null,                                              true, 10),
  ('00000000-0000-0000-0000-000000000001','feature_card',   null,                                                                                null,   true, 11),
  ('00000000-0000-0000-0000-000000000001','stores',         'Our Stores in Mogappair',                                                          null,                                              true, 12),
  ('00000000-0000-0000-0000-000000000001','promo',          null,                                                                                null,   true, 13),
  ('00000000-0000-0000-0000-000000000001','top_sunglasses', 'Top Sunglasses',                                                                   'Style meets protection',                          true, 14),
  ('00000000-0000-0000-0000-000000000001','ugc',            'Looks We Love From You',                                                           'Real customers. Real style. Tag @PowerEyesOpticals', true, 15),
  ('00000000-0000-0000-0000-000000000001','whatsapp_cta',   null,                                                                                null,   true, 16),
  ('00000000-0000-0000-0000-000000000001','footer',         null,                                                                                null,   true, 17),
  ('00000000-0000-0000-0000-000000000001','lenses_guide',   'Lens Guide',                                                                       null,                                              false, 99)
on conflict (org_id, key) do nothing;

-- Section-level "View All" links live on the section row (columns created in
-- the table definition above).
update website_sections set cta_label = 'View All Frames',  cta_link = '/eyeglasses'       where key = 'frame_finder';
update website_sections set cta_label = 'View All',         cta_link = '/eyeglasses'       where key = 'best_seller';
update website_sections set cta_label = 'View All Lenses',  cta_link = '/lenses'           where key = 'lens_type';
update website_sections set cta_label = 'View All',         cta_link = '/eyeglasses'       where key = 'lifestyle_chip';
update website_sections set cta_label = 'View All Stores',  cta_link = '/store-locator'    where key = 'stores';
update website_sections set cta_label = 'View All',         cta_link = '/sunglasses'       where key = 'top_sunglasses';
update website_sections set cta_label = 'View All',         cta_link = '/eyeglasses'       where key = 'category_card';

-- ── Part 6: content rows ─────────────────────────────────────────────────────
-- Existing rows are TAGGED (they already hold the right copy); new rows are
-- INSERTed. ON CONFLICT makes the whole file safe to re-run.

-- 6a. Announcement bar. The 0009 seed copy ("Free adjustments on all frames…")
--     never rendered — Header.tsx hardcodes the live text — so the row is
--     updated in place rather than duplicated.
update website_content set
  key           = 'info',
  title         = 'Mogappair East, Chennai · Your Family''s Vision Partner Since 1998',
  cta_label     = 'WhatsApp Support',
  cta_link      = 'https://wa.me/919840496404',
  display_order = 1,
  is_active     = true
where section = 'announcement' and key is null;

-- 6b. Logo block (header).
insert into website_content (org_id, section, key, title, badge, subtitle, icon, display_order, is_active)
values ('00000000-0000-0000-0000-000000000001','site_logo','main',
        'POWER EYES','OPTICALS','Since 1998 — Your Family''s Vision Partner','👁',1,true)
on conflict (org_id, section, key) do nothing;

-- 6c. Nav menu (9 items). The Eyeglasses mega-menu is parked in `body` as JSON
--     so it is not lost — Phase 6 wires it back up.
insert into website_content (org_id, section, key, title, cta_link, body, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','nav','nav_1','Eyeglasses','/eyeglasses',
   '[{"title":"By Shape","items":["Round","Square","Rectangle","Cat Eye","Aviator","Oval"]},{"title":"By Brand","items":["Ray-Ban","Vogue","Oakley","Titan","John Jacobs","Lenskart"]},{"title":"By Need","items":["Computer Glasses","Progressive","Reading","Kids Eyewear"]}]',1,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_2','Sunglasses','/sunglasses',null,2,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_3','Contact Lenses','/contact-lenses',null,3,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_4','Computer Glasses','/eyeglasses?kind=computer',null,4,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_5','Kids Eyewear','/eyeglasses?gender=kids',null,5,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_6','Lens & Coatings','/lenses',null,6,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_7','Offers','/offers',null,7,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_8','Eye Test','/eye-test',null,8,true),
  ('00000000-0000-0000-0000-000000000001','nav','nav_9','About Us','/about',null,9,true)
on conflict (org_id, section, key) do nothing;

-- 6d. Hero. Row 1 becomes the main hero (badge = eyebrow, cta2 = second button).
--     Row 2 keeps its 0009 slide copy but is deactivated so the page stays
--     visually identical (the live page is static, not a carousel). The floating
--     "Clearer Vision / Brighter Days" badge is a separate keyed row.
update website_content set
  key         = 'main',
  badge       = 'Since 1998',
  cta2_label  = 'Book Eye Test',
  cta2_link   = '/eye-test',
  image_alt   = 'Power Eyes Opticals storefront'
where section = 'hero' and key is null and display_order = 1;

update website_content set key = 'slide_2', is_active = false
where section = 'hero' and key is null and display_order = 2;

insert into website_content (org_id, section, key, title, subtitle, display_order, is_active)
values ('00000000-0000-0000-0000-000000000001','hero','badge',
        'Clearer Vision','Brighter Days',3,true)
on conflict (org_id, section, key) do nothing;

-- Hero feature chips (parent_key = 'main').
insert into website_content (org_id, section, key, parent_key, icon, title, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','hero','feature_1','main','👁️','Expert Eye Care',10,true),
  ('00000000-0000-0000-0000-000000000001','hero','feature_2','main','📋','Prescription Support',11,true),
  ('00000000-0000-0000-0000-000000000001','hero','feature_3','main','🏪','Real Stores E&W',12,true),
  ('00000000-0000-0000-0000-000000000001','hero','feature_4','main','👨‍👩‍👧','Family Vision ID',13,true)
on conflict (org_id, section, key) do nothing;

-- 6e. Category cards (4).
insert into website_content (org_id, section, key, title, subtitle, cta_link, icon, bg_color, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','category_card','eyeglasses','Eyeglasses','For everyday life','/eyeglasses','🕶️','from-blue-50 to-blue-100',1,true),
  ('00000000-0000-0000-0000-000000000001','category_card','sunglasses','Sunglasses','Style meets protection','/sunglasses','😎','from-amber-50 to-amber-100',2,true),
  ('00000000-0000-0000-0000-000000000001','category_card','kids','Kids Eyewear','Growing eyes, brighter tomorrows','/eyeglasses?gender=kids','👧','from-emerald-50 to-emerald-100',3,true),
  ('00000000-0000-0000-0000-000000000001','category_card','lenses','Lenses','Advanced vision for a better you','/lenses','🔬','from-violet-50 to-violet-100',4,true)
on conflict (org_id, section, key) do nothing;

-- 6f. "Find Your Perfect Frame" filter tabs (6). The site currently renders
--     these as inert buttons; keys make them addressable in Phase 4.
insert into website_content (org_id, section, key, title, cta_link, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_shape',      'By Shape',      '/eyeglasses',             1,true),
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_face_shape', 'By Face Shape', '/eyeglasses',             2,true),
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_lifestyle',  'By Lifestyle',  '/eyeglasses',             3,true),
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_need',       'By Need',       '/eyeglasses',             4,true),
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_gender',     'By Gender',     '/eyeglasses',             5,true),
  ('00000000-0000-0000-0000-000000000001','frame_finder','tab_help',       'Help Me Choose','/help-me-choose',         6,true)
on conflict (org_id, section, key) do nothing;

-- 6g. Shape chips (8) — replaces the SHAPES const in apps/web/src/lib/types.ts.
--     cta_link preserves the exact href the current code builds (toLowerCase()).
insert into website_content (org_id, section, key, title, cta_link, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','shape_chip','round',     'Round',     '/eyeglasses?shape=round',     '👓',1,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','square',    'Square',    '/eyeglasses?shape=square',    '👓',2,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','rectangle', 'Rectangle', '/eyeglasses?shape=rectangle', '👓',3,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','cat_eye',   'Cat Eye',   '/eyeglasses?shape=cat eye',   '👓',4,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','aviator',   'Aviator',   '/eyeglasses?shape=aviator',   '👓',5,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','geometric', 'Geometric', '/eyeglasses?shape=geometric', '👓',6,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','browline',  'Browline',  '/eyeglasses?shape=browline',  '👓',7,true),
  ('00000000-0000-0000-0000-000000000001','shape_chip','oval',      'Oval',      '/eyeglasses?shape=oval',      '👓',8,true)
on conflict (org_id, section, key) do nothing;

-- 6h. Best-seller filter tabs (2). Both currently render identically and do
--     nothing; keys let Phase 4 wire them to public_catalog.kind.
insert into website_content (org_id, section, key, title, cta_link, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','best_seller','tab_frame',   'Eyeglasses','/eyeglasses',  1,true),
  ('00000000-0000-0000-0000-000000000001','best_seller','tab_sunglass','Sunglasses','/sunglasses',  2,true)
on conflict (org_id, section, key) do nothing;

-- 6i. Collection banners — the 3 existing rows already match the live render,
--     so only keys are added.
update website_content set key = 'banner_new'         where section = 'collection_banner' and key is null and display_order = 1;
update website_content set key = 'banner_progressive' where section = 'collection_banner' and key is null and display_order = 2;
update website_content set key = 'banner_rx_sun'      where section = 'collection_banner' and key is null and display_order = 3;

-- 6j. Lens type cards (6) — replaces the LENS_TYPES const.
insert into website_content (org_id, section, key, title, subtitle, cta_link, bg_color, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','lens_type','blue_light',  'Blue Light',  'For screen & work',    '/lenses?type=blue_light',  'from-blue-900 to-blue-700',    1,true),
  ('00000000-0000-0000-0000-000000000001','lens_type','progressive', 'Progressive', 'All distances, one lens','/lenses?type=progressive','from-teal-800 to-teal-600',    2,true),
  ('00000000-0000-0000-0000-000000000001','lens_type','driving',     'Driving',     'Clearer & safer nights','/lenses?type=driving',     'from-slate-800 to-slate-700',  3,true),
  ('00000000-0000-0000-0000-000000000001','lens_type','photochromic','Photochromic','Indoor to outdoor',     '/lenses?type=photochromic','from-amber-800 to-amber-600',  4,true),
  ('00000000-0000-0000-0000-000000000001','lens_type','high_power',  'High Power',  'Expert solutions',      '/lenses?type=high_power',  'from-navy-800 to-navy-700',    5,true),
  ('00000000-0000-0000-0000-000000000001','lens_type','kids',        'Kids Lenses', 'Tough & safe',          '/lenses?type=kids',        'from-emerald-800 to-emerald-600',6,true)
on conflict (org_id, section, key) do nothing;

-- 6k. Lifestyle chips (8) — replaces the LIFESTYLE const.
insert into website_content (org_id, section, key, title, cta_link, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','office',   'Office',   '/eyeglasses?lifestyle=office',   '💼',1,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','computer', 'Computer', '/eyeglasses?lifestyle=computer', '💻',2,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','driving',  'Driving',  '/eyeglasses?lifestyle=driving',  '🚗',3,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','travel',   'Travel',   '/eyeglasses?lifestyle=travel',   '✈️',4,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','sports',   'Sports',   '/eyeglasses?lifestyle=sports',   '⚽',5,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','everyday', 'Everyday', '/eyeglasses?lifestyle=everyday', '☀️',6,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','kids',     'Kids',     '/eyeglasses?lifestyle=kids',     '🎒',7,true),
  ('00000000-0000-0000-0000-000000000001','lifestyle_chip','premium',  'Premium',  '/eyeglasses?lifestyle=premium',  '⭐',8,true)
on conflict (org_id, section, key) do nothing;

-- 6l. Feature cards: the two big panels, their 3 sub-tiles and the 4 checklist
--     items. bg_color stores which visual variant to render.
insert into website_content (org_id, section, key, title, subtitle, cta_label, cta_link, bg_color, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','feature_card','not_sure',
   'Not Sure What You Need?','Get expert guidance from our optometrists.',
   'Try EYES Consultation →','/help-me-choose','light',1,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','family_vision',
   'Your Family''s Vision, All in One Place','Create a Vision ID for your entire family.',
   'Create Your Family Vision ID →','/my/vision-id','navy',2,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, icon, title, cta_link, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','feature_card','consult_online','not_sure','💻','Online Consultation','/help-me-choose',1,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','consult_store', 'not_sure','🏪','In-Store Consultation','/store-locator',2,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','upload_rx',     'not_sure','📋','Upload Prescription','/my/prescriptions',3,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, title, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','feature_card','chk_1','family_vision','Track prescriptions',1,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','chk_2','family_vision','Set eye test reminders',2,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','chk_3','family_vision','Manage family members',3,true),
  ('00000000-0000-0000-0000-000000000001','feature_card','chk_4','family_vision','Get personalised recommendations',4,true)
on conflict (org_id, section, key) do nothing;

-- 6m. "Book an Eye Test" promo banner (the `promo` section existed in the ERP
--     dropdown but had no rows and was never read by the site).
insert into website_content (org_id, section, key, title, subtitle, cta_label, cta_link, bg_color, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','promo','eye_test',
   'Book an Eye Test Today',
   'Professional eye care for you and your family at our Mogappair stores.',
   'Book Eye Test →','/eye-test','from-gold-500 to-gold-600',1,true)
on conflict (org_id, section, key) do nothing;

-- 6n. UGC gallery: 8 tiles + the "Show Us Your Style" tile. Tiles carry a
--     placeholder icon until real photos are uploaded (Phase 2 UI).
insert into website_content (org_id, section, key, title, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','ugc','tile_1','Customer look 1','👓',1,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_2','Customer look 2','👓',2,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_3','Customer look 3','👓',3,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_4','Customer look 4','👓',4,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_5','Customer look 5','👓',5,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_6','Customer look 6','👓',6,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_7','Customer look 7','👓',7,true),
  ('00000000-0000-0000-0000-000000000001','ugc','tile_8','Customer look 8','👓',8,true),
  ('00000000-0000-0000-0000-000000000001','ugc','show_us','Show Us Your Style','📸',9,true)
on conflict (org_id, section, key) do nothing;

update website_content set subtitle = 'Tag @PowerEyesOpticals'
where section = 'ugc' and key = 'show_us';

-- 6o. Floating WhatsApp button.
insert into website_content (org_id, section, key, title, cta_link, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','whatsapp_cta','float',
   'Chat on WhatsApp','https://wa.me/919840185186','💬',1,true)
on conflict (org_id, section, key) do nothing;

-- 6p. Footer. parent_key groups: 'brand' → contact rows, 'col_*' → column
--     links, 'trust' → badges, 'social' → social icons.
insert into website_content (org_id, section, key, title, badge, subtitle, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','brand','POWER EYES','SINCE 1998',
   'Your Family''s Vision Partner. Expert eye care and premium eyewear for every generation.',1,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, icon, title, cta_link, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','contact_addr','brand','map',
   '2/56 Velayapathi Salai, Mogappair East, Chennai – 600 037','https://maps.google.com/?q=2%2F56+Velayapathi+Salai+Mogappair+East+Chennai',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','contact_phone','brand','phone',
   '98401 85186','tel:+919840185186',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','contact_email','brand','mail',
   'powereyes.chennai@gmail.com','mailto:powereyes.chennai@gmail.com',3,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, title, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','col_shop',       'Shop',        10,true),
  ('00000000-0000-0000-0000-000000000001','footer','col_eye_care',   'Eye Care',    11,true),
  ('00000000-0000-0000-0000-000000000001','footer','col_my_account', 'My Account',  12,true),
  ('00000000-0000-0000-0000-000000000001','footer','col_support',    'Support',     13,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, title, cta_link, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_1','col_shop','Eyeglasses','/eyeglasses',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_2','col_shop','Sunglasses','/sunglasses',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_3','col_shop','Kids Eyewear','/eyeglasses?gender=kids',3,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_4','col_shop','Contact Lenses','/contact-lenses',4,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_5','col_shop','Lens Packages','/lenses',5,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_shop_6','col_shop','Accessories','/accessories',6,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_eye_1','col_eye_care','Book Eye Test','/eye-test',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_eye_2','col_eye_care','EYES Consultation','/help-me-choose',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_eye_3','col_eye_care','Upload Prescription','/my/prescriptions',3,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_eye_4','col_eye_care','Lens Guide','/lens-guide',4,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_eye_5','col_eye_care','Eye Care Blog','/blog',5,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_1','col_my_account','My Power Eyes','/my',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_2','col_my_account','Vision ID','/my/vision-id',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_3','col_my_account','My Orders','/my/orders',3,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_4','col_my_account','Track Order','/my/orders',4,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_5','col_my_account','Loyalty Rewards','/my/loyalty',5,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_acct_6','col_my_account','Wishlist','/wishlist',6,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_1','col_support','Store Locator','/store-locator',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_2','col_support','Warranty & Repairs','/my/repairs',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_3','col_support','Easy Returns','/returns',3,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_4','col_support','FAQs','/faq',4,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_5','col_support','Privacy Policy','/privacy',5,true),
  ('00000000-0000-0000-0000-000000000001','footer','lnk_sup_6','col_support','Terms of Service','/terms',6,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, title, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','trust_1','trust','100% Genuine Products','✓',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','trust_2','trust','Prescription Verified','✓',2,true),
  ('00000000-0000-0000-0000-000000000001','footer','trust_3','trust','Free Adjustments','✓',3,true),
  ('00000000-0000-0000-0000-000000000001','footer','trust_4','trust','Easy Returns','✓',4,true),
  ('00000000-0000-0000-0000-000000000001','footer','trust_5','trust','Secure Payments','✓',5,true),
  ('00000000-0000-0000-0000-000000000001','footer','trust_6','trust','Dedicated Support','✓',6,true)
on conflict (org_id, section, key) do nothing;

insert into website_content (org_id, section, key, parent_key, title, cta_link, icon, display_order, is_active) values
  ('00000000-0000-0000-0000-000000000001','footer','social_instagram','social','Instagram','#','instagram',1,true),
  ('00000000-0000-0000-0000-000000000001','footer','social_facebook', 'social','Facebook', '#','facebook', 2,true),
  ('00000000-0000-0000-0000-000000000001','footer','social_youtube',  'social','YouTube',  '#','youtube',  3,true)
on conflict (org_id, section, key) do nothing;
