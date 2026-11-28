-- The accessories listing renders the same "Guide" button as the other
-- categories, which requests `guide-accessories`. The seed only shipped
-- guides for eyewear categories, so every accessories visit produced a 404.
-- Add a lightweight, editable guide for every organisation that already has
-- guides, keeping the API contract (`title`, `subtitle`, `body`) intact.

insert into public.site_pages (
  org_id, slug, kind, title, subtitle, body,
  is_active, show_in_nav, display_order, is_system
)
select
  g.org_id,
  'guide-accessories',
  'guide',
  'Eyewear Accessories Guide',
  'Care, cases and cleaning essentials',
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object('heading', 'Cleaning kits', 'body', 'Use a microfibre cloth and lens-safe spray. Never use paper towels — they scratch coatings.'),
      jsonb_build_object('heading', 'Cases', 'body', 'A hard shell case protects frames from pressure in a bag. Store lenses dry and away from heat.'),
      jsonb_build_object('heading', 'Replacement parts', 'body', 'Nose pads and temple tips are consumables. Replace them when frames slip or pinch.')
    )
  )::jsonb,
  true, false, 12, true
from public.site_pages g
where g.slug = 'guide-sunglasses'
  and not exists (
    select 1 from public.site_pages p
    where p.org_id = g.org_id and p.slug = 'guide-accessories'
  );
