-- 0022 — Tier 2 "meaningful conversion" website features
-- Run AFTER 0019 → 0020 → 0021 (Supabase SQL Editor).
--
--  1. public_catalog gains `stock_qty`  → "Only 2 left in stock" urgency labels
--  2. product_view_counts + RPC         → "8 people viewed this today" labels
--  3. public read on loyalty_rules      → "You'll earn +48 points" on the cart
--
-- All website code degrades gracefully when this file is not yet applied:
-- missing columns/functions are read with optional chaining and simply hide
-- the corresponding label.

-- ── 1. Stock count on the public catalog ─────────────────────────────────────
-- CREATE OR REPLACE may only append columns, so stock_qty goes last.
create or replace view public_catalog as
select p.id, p.org_id, p.kind, p.sku, b.name as brand, p.model, p.collection, p.gender, p.selling_price, p.mrp,
  p.power_eligible, p.featured, p.new_arrival, p.bestseller, p.short_desc, p.description, p.images, p.attrs,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0) > 0 as in_stock,
  coalesce((select sum(s.qty) from stock s where s.product_id = p.id), 0)::int as stock_qty
from products p left join brands b on b.id = p.brand_id where p.visible_on_website and p.status = 'active';
grant select on public_catalog to anon, authenticated;

-- ── 2. Product view counters ─────────────────────────────────────────────────
-- One row per product: lifetime views + a today counter that resets when the
-- UTC date rolls over. trackView() bumps it via the RPC below.
create table if not exists product_view_counts (
  product_id  uuid primary key references products(id) on delete cascade,
  views       int not null default 0,
  today_views int not null default 0,
  counted_on  date not null default current_date,
  updated_at  timestamptz default now()
);

alter table product_view_counts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'pvc_public_read') then
    create policy pvc_public_read on product_view_counts
      for select to anon, authenticated using (true);
  end if;
end $$;

-- SECURITY DEFINER so anon can bump counts without direct write access.
create or replace function public.bump_product_view(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into product_view_counts (product_id, views, today_views, counted_on)
  values (p_id, 1, 1, current_date)
  on conflict (product_id) do update set
    views = product_view_counts.views + 1,
    today_views = case when product_view_counts.counted_on = current_date
                        then product_view_counts.today_views + 1 else 1 end,
    counted_on = current_date,
    updated_at = now();
end $$;
grant execute on function public.bump_product_view(uuid) to anon, authenticated;

-- ── 3. Website can read the loyalty earn rate ────────────────────────────────
-- Single config row per org (points per ₹100 spent); the cart page reads it to
-- show "You'll earn +N points from this order". Balance reads stay RLS-guarded
-- to the owning customer via the existing loyalty_ledger policies.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'loyalty_rules_public') then
    create policy loyalty_rules_public on loyalty_rules
      for select to anon, authenticated using (true);
  end if;
end $$;
