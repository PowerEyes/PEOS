-- Cart (persistent per customer, website use only)
create table cart_items (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  lens_package_id uuid references lens_packages(id),
  option_ids uuid[] not null default '{}',
  qty int not null default 1 check (qty > 0),
  rx_snapshot jsonb,
  created_at timestamptz default now(),
  unique (customer_id, product_id, lens_package_id));

alter table cart_items enable row level security;
create policy cart_own on cart_items for all to authenticated
  using (customer_id = (select id from customers where auth_user_id = auth.uid() limit 1))
  with check (customer_id = (select id from customers where auth_user_id = auth.uid() limit 1));

-- Customer wishlist RLS (already created in 0009, verify)
-- Orders public view for customer (reads from sales table)
create or replace view customer_orders as
  select s.id, s.code, s.kind, s.status, s.payment_status, s.grand_total, s.paid_total,
    s.needs_lab, s.created_at, s.rx_snapshot, s.supply_type, s.customer_id,
    array_agg(json_build_object('description',l.description,'details',l.details,'qty',l.qty,'line_total',l.line_total,'line_type',l.line_type) order by l.line_no) as lines
  from sales s join sale_lines l on l.sale_id = s.id where s.kind = 'order'
  group by s.id;

-- Customer must link their auth account to their customer record
-- Done via API route after signup/login (see apps/web/src/app/api/customer-link/route.ts)
-- Their auth_user_id is stored on the customers table

-- Razorpay payment records
create table online_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  sale_id uuid references sales(id),
  customer_id uuid not null references customers(id),
  razorpay_order_id text not null, razorpay_payment_id text, razorpay_signature text,
  amount numeric(12,2) not null, currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz default now());
alter table online_payments enable row level security;
create policy online_payments_insert on online_payments for insert to anon, authenticated with check (true);
create policy online_payments_own on online_payments for select to authenticated using (
  customer_id = (select id from customers where auth_user_id = auth.uid() limit 1));

-- Blog (CMS controlled from PowerOS Website Controller)
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  slug text not null, title text not null, excerpt text, body text, cover_image text,
  tags text[] default '{}', author text, status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz, created_at timestamptz default now(), unique (org_id, slug));
alter table blog_posts enable row level security;
create policy blog_anon on blog_posts for select to anon using (status = 'published');
create policy blog_staff on blog_posts for select using (org_id = public.current_org());
create policy blog_write on blog_posts for insert with check (org_id = public.current_org() and public.is_admin());
create policy blog_update on blog_posts for update using (org_id = public.current_org() and public.is_admin());

-- Public read for customer_orders view
grant select on customer_orders to authenticated;
