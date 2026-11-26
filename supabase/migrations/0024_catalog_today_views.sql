-- ── 0024: expose product_view_counts on public_catalog ───────────────────────
--
-- 0022_conversion_features.sql created `product_view_counts` + the
-- `bump_product_view()` RPC, and apps/web already reads `p.today_views`
-- (ProductCard.tsx:18 → "👁 N people viewed this today"). But 0022 only ever
-- added `stock_qty` to the view, never `today_views` — so the field was always
-- undefined and the label could never render, no matter how many times the RPC
-- fired.
--
-- This appends `today_views` to the view (CREATE OR REPLACE may only append
-- columns, which is why it goes last, right after stock_qty).
--
-- The counter is read-only here: writes still go through bump_product_view(),
-- and pvc_public_read (0022) already lets anon read the table directly.

create or replace view public_catalog as
select p.id, p.org_id, p.kind, p.sku, b.name as brand, p.model, p.collection, p.gender, p.selling_price, p.mrp,
  p.power_eligible, p.featured, p.new_arrival, p.bestseller, p.short_desc, p.description, p.images, p.attrs,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0) > 0 as in_stock,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0)::int as stock_qty,
  coalesce(v.today_views, 0)::int as today_views
from products p
  left join brands b on b.id = p.brand_id
  left join product_view_counts v on v.product_id = p.id
where p.visible_on_website and p.status = 'active';

grant select on public_catalog to anon, authenticated;
