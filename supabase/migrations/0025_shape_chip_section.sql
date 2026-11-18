-- ── 0025: register the missing `shape_chip` section ─────────────────────────
--
-- 0023 seeded 18 website_sections rows, but website_content spans 17 section
-- keys and `shape_chip` (the 8 frame-shape buttons) was never given a row.
-- Consequences before this fix:
--   * the ERP Homepage tab fell back to appending it after `footer`
--     (view.tsx sectionKeys), so it sat in the wrong place
--   * it had no row in the Sections tab — could not be hidden or reordered
--   * the public site had no `enabled` flag for it, so it could never be turned
--     off even though every other block could
--
-- It is inserted directly AFTER `frame_finder`, because on the live page the
-- shape grid sits inside the "Find Your Perfect Frame" band. Position is
-- computed from frame_finder's current display_order rather than a literal, so
-- this stays correct even after someone has reordered sections in the ERP.
--
-- `title` is deliberately NULL: that block renders no heading (the heading
-- belongs to frame_finder). Seeding a title would offer the operator a field
-- in the ERP that does nothing on the site.
--
-- Idempotent: the whole body only runs when the row is absent.
--
-- org_id is hardcoded rather than taken from public.current_org(): that
-- function reads the request JWT and is NULL when a migration runs, which
-- aborted the first attempt of this file with a not-null violation. 0023 seeds
-- the same way.

do $$
declare ff_order int;
begin
  if exists (select 1 from website_sections where key = 'shape_chip') then
    return; -- already registered
  end if;

  select display_order into ff_order from website_sections where key = 'frame_finder';
  ff_order := coalesce(ff_order, 6);

  insert into website_sections (org_id, key, title, subtitle, enabled, display_order)
  values ('00000000-0000-0000-0000-000000000001', 'shape_chip', null, null, true, ff_order + 1);

  -- Make room: everything currently after frame_finder moves down one.
  -- (lenses_guide at 99 shifts to 100 — correct, it is also after frame_finder.)
  update website_sections
     set display_order = display_order + 1
   where display_order > ff_order
     and key <> 'shape_chip';
end $$;
