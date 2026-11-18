-- ── Public (anon) read policies for website ──────────────────────────────────
-- Products public catalog
create policy products_anon on products for select to anon
  using (visible_on_website and status = 'active');
create policy brands_anon on brands for select to anon using (true);
create policy lens_packages_anon on lens_packages for select to anon using (status = 'active');
create policy lens_options_anon on lens_options for select to anon using (status = 'active');
create policy branches_anon on branches for select to anon using (is_active);
create policy org_anon on organizations for select to anon using (true);

-- ── Product reviews ──────────────────────────────────────────────────────────
create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid references customers(id),
  reviewer_name text not null, reviewer_email text,
  rating int not null check (rating between 1 and 5),
  title text, body text, images text[] default '{}',
  verified_purchase boolean default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now());
create index on product_reviews (product_id, status);
alter table product_reviews enable row level security;
create policy reviews_anon on product_reviews for select to anon using (status = 'approved');
create policy reviews_staff on product_reviews for select using (org_id = public.current_org());
create policy reviews_insert on product_reviews for insert to anon with check (true);
create policy reviews_mgmt on product_reviews for update using (org_id = public.current_org());

-- Review summary view for product pages
create view product_review_summary as
  select product_id, count(*)::int as total_reviews, round(avg(rating)::numeric,1) as avg_rating,
    count(*) filter (where rating=5)::int as r5, count(*) filter (where rating=4)::int as r4,
    count(*) filter (where rating=3)::int as r3, count(*) filter (where rating=2)::int as r2,
    count(*) filter (where rating=1)::int as r1
  from product_reviews where status='approved' group by product_id;
grant select on product_review_summary to anon, authenticated;

-- ── Wishlist (per customer, persisted) ──────────────────────────────────────
create table customer_wishlist (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz default now(), unique (customer_id, product_id));
alter table customer_wishlist enable row level security;
create policy wishlist_own on customer_wishlist for all using (
  customer_id = (select id from customers where auth_user_id = auth.uid() limit 1));

-- Customer needs an auth_user_id link for portal
alter table customers add column if not exists auth_user_id uuid references auth.users(id);
create index if not exists customers_auth_uid on customers (auth_user_id);

-- ── Website CMS content ──────────────────────────────────────────────────────
create table website_content (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  section text not null, -- 'hero','announcement','collection_banner','lenses_guide','promo'
  title text, subtitle text, body text, image_path text, video_url text, link text,
  badge text, cta_label text, cta_link text, bg_color text,
  display_order int not null default 0, is_active boolean not null default true,
  valid_from date, valid_until date, created_at timestamptz default now());
create index on website_content (org_id, section, is_active, display_order);
alter table website_content enable row level security;
create policy wc_anon on website_content for select to anon using (is_active and (valid_until is null or valid_until >= current_date));
create policy wc_staff on website_content for select using (org_id = public.current_org());
create policy wc_write on website_content for insert with check (org_id = public.current_org() and public.is_admin());
create policy wc_update on website_content for update using (org_id = public.current_org() and public.is_admin());

-- ── Loyalty points ledger ────────────────────────────────────────────────────
create table loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  customer_id uuid not null references customers(id),
  delta int not null, -- positive = earned, negative = redeemed
  reason text not null, ref_id uuid, created_at timestamptz default now());
create index on loyalty_ledger (org_id, customer_id, created_at desc);
alter table loyalty_ledger enable row level security;
create policy loyalty_staff on loyalty_ledger for select using (org_id = public.current_org());

create view customer_loyalty_balance as
  select org_id, customer_id, coalesce(sum(delta),0)::int as points
  from loyalty_ledger group by org_id, customer_id;

-- Seed default CMS content (placeholders that Power Eyes can replace via Website Controller)
insert into website_content (org_id, section, title, subtitle, cta_label, cta_link, display_order) values
  ('00000000-0000-0000-0000-000000000001','hero','Your Family''s Vision Partner','Eyewear, eye care and expert guidance for every generation.','Shop Eyewear','/eyeglasses',1),
  ('00000000-0000-0000-0000-000000000001','hero','Clearer Vision. Brighter Days.','Progressive lenses from ₹1,500. Perfect for every distance.','Explore Lenses','/lenses',2),
  ('00000000-0000-0000-0000-000000000001','announcement','Free adjustments on all frames. WhatsApp us anytime.',null,null,null,1),
  ('00000000-0000-0000-0000-000000000001','collection_banner','New Collection','Everyday Frames For Every Story','Shop Collection','/eyeglasses?collection=new',1),
  ('00000000-0000-0000-0000-000000000001','collection_banner','Progressive Lenses','Seamless Vision At Every Distance','Explore Progressive','/lenses',2),
  ('00000000-0000-0000-0000-000000000001','collection_banner','Prescription Sunglasses','See Clearly Everywhere','Shop Sunglasses','/sunglasses',3) on conflict do nothing;
