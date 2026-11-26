-- ── Family members table ──────────────────────────────────────────────────────
create table if not exists family_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  customer_id  uuid not null references customers(id) on delete cascade,
  name         text not null,
  relationship text not null default 'family',   -- spouse|child|parent|sibling|other
  dob          date,
  gender       text,
  phone        text,
  notes        text,
  created_at   timestamptz default now()
);
alter table family_members enable row level security;
create policy fm_staff    on family_members for all using (org_id = public.current_org());
create policy fm_customer on family_members for all to authenticated using (
  customer_id = (select id from customers where auth_user_id = auth.uid() limit 1));

-- Allow prescriptions to be linked to a family member
alter table prescriptions add column if not exists family_member_id uuid references family_members(id);
create index if not exists idx_prescriptions_family on prescriptions(family_member_id);

-- ── WhatsApp opt-in on customer record ────────────────────────────────────────
alter table customers add column if not exists whatsapp_opt_in boolean not null default false;
alter table customers add column if not exists whatsapp_opt_in_at timestamptz;

-- Backfill: opt in customers who have already received messages (they haven't opted out)
-- update customers set whatsapp_opt_in = true where phone is not null and phone != '';

comment on column customers.whatsapp_opt_in    is 'Customer consented to receive WhatsApp marketing messages';
comment on column customers.whatsapp_opt_in_at is 'Timestamp when customer gave consent';

-- ── Offers / campaigns table ──────────────────────────────────────────────────
create table if not exists offers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  title        text not null,
  subtitle     text,
  description  text,
  image_url    text,
  badge        text,              -- "SALE", "NEW", "LIMITED"
  coupon_code  text,              -- optional linked coupon
  bg_color     text default '#0B1B36',
  text_color   text default '#FFFFFF',
  cta_label    text default 'Shop Now',
  cta_href     text default '/eyeglasses',
  valid_from   date,
  valid_until  date,
  display_order int default 0,
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);
alter table offers enable row level security;
create policy offers_staff  on offers for all using (org_id = public.current_org());
create policy offers_public on offers for select to anon, authenticated using (
  is_active = true
  and (valid_from is null or valid_from <= current_date)
  and (valid_until is null or valid_until >= current_date));

-- Seed sample offers
insert into offers (org_id,title,subtitle,description,badge,coupon_code,bg_color,cta_label,cta_href,valid_until)
values
  ('00000000-0000-0000-0000-000000000001','Flat 10% Off Everything','Use code POWER10 at checkout','Applies on all frames, sunglasses and lenses. No minimum order.','LIMITED TIME','POWER10','#0B1B36','Shop Now →','/eyeglasses','2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','Buy 1 Get 1 on Sunglasses','On selected brands','Choose any two sunglasses from our BOGO collection and pay for just one.','BOGO',null,'#D97706','Shop Sunglasses →','/sunglasses','2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','Kids Eyewear Fest','Extra 15% on kids frames','Safe, durable and stylish frames for children. Use code EYES100.','KIDS','EYES100','#1D4ED8','Shop Kids →','/kids','2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','Free Eye Test','Professional eye test, no charge','Book your comprehensive eye test at our Mogappair East store. Walk-in or book online.','FREE',null,'#065F46','Book Now →','/eye-test',null)
on conflict do nothing;

grant select on offers to anon, authenticated;
