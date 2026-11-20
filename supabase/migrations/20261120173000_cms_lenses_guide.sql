-- ── CMS polish: Lens Guide content + Cat Eye URL fix ────────────────────────
--
-- 1. Lens Guide. The website had a registry row for `lenses_guide` but no
--    renderer and no content, so the block could never appear. This seeds the
--    seven educational cards; the app reads them straight from
--    website_content, so no copy is hardcoded in the client and every word can
--    be rewritten from the Website Controller.
--    The website_sections row is deliberately left `enabled = false`: review
--    the block in preview first, then flip `enabled` to publish it.
--
-- 2. Cat Eye chip. The shape chip linked to `/eyeglasses?shape=cat eye` — a
--    raw space is not legal in a URL, so the link breaks the moment it is
--    copied, shared or passed through anything that does not encode it. It now
--    uses the hyphenated form; the eyeglasses/sunglasses filters normalise
--    `-`/`_` back to a space before the case-insensitive shape match, so
--    `cat-eye` still resolves to the stored `Cat Eye` value.
--
-- Idempotent: content keys are unique per section (website_content_key_uniq),
-- and the link rewrite only fires while the old value is still present, so an
-- operator who retargets the chip keeps their edit on a re-run.

insert into website_content
  (org_id, section, key, title, subtitle, body, icon, cta_label, cta_link, display_order, is_active)
values
  ('00000000-0000-0000-0000-000000000001','lenses_guide','single_vision',
   'Single Vision','One prescription, one distance',
   'A single lens power runs across the whole lens and corrects one viewing distance - distance, reading or screens. It is the simplest and most affordable way to correct a refraction.',
   '👁️','View packages','/lenses',1,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','progressive',
   'Progressive','Near, middle and far in one lens',
   'Three zones blend into each other with no visible line, so you can look up for the road, across for the monitor and down for your phone without switching glasses.',
   '🔬','View packages','/lenses',2,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','blue_light',
   'Blue Light','Easier on screen-heavy days',
   'Filters part of the high-energy visible light emitted by monitors and phones. Worth considering if you work at a screen for hours and want less eye strain by the end of the day.',
   '🖥️','View packages','/lenses',3,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','photochromic',
   'Photochromic','Darkens outdoors, clears indoors',
   'The lens reacts to sunlight and tints automatically outside, then returns to clear indoors. One pair covers the walk in, the drive and the desk.',
   '🌗','View packages','/lenses',4,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','driving',
   'Driving','Contrast that holds up at night',
   'Tuned for road distance, dashboard readouts and oncoming headlights, with glare control that keeps lane markings and signs crisp after dark.',
   '🚗','View packages','/lenses',5,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','high_index',
   'High Index','Thinner and lighter lenses',
   'A denser material keeps strong prescriptions slim, so the frame sits flatter against your face instead of magnifying your eyes at the edges.',
   '🪶','View packages','/lenses',6,true),

  ('00000000-0000-0000-0000-000000000001','lenses_guide','kids',
   'Kids Lenses','Tough enough for growing eyes',
   'Flexible, impact-resistant lenses with coatings that shrug off scratches and fingerprints - built for playgrounds, sport and long school days.',
   '🧒','View packages','/lenses',7,true)
on conflict (org_id, section, key) do nothing;

-- Section heading CTA, only while the operator has not set their own.
update website_sections
   set cta_label = 'Get Expert Advice', cta_link = '/help-me-choose'
 where org_id = '00000000-0000-0000-0000-000000000001'
   and key = 'lenses_guide'
   and cta_label is null;

-- Cat Eye chip: raw space -> hyphen. Guarded on the old value so a re-run
-- never clobbers a link the operator has since changed.
update website_content
   set cta_link = '/eyeglasses?shape=cat-eye'
 where org_id = '00000000-0000-0000-0000-000000000001'
   and section = 'shape_chip'
   and key = 'cat_eye'
   and cta_link = '/eyeglasses?shape=cat eye';
