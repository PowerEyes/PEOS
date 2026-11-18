-- ── Auto-sync website signups → ERP customers ───────────────────────────────
-- Fires immediately when someone registers on the website.
-- Staff signups are skipped (they have is_staff=true in metadata).
create or replace function public.sync_auth_to_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000000001';
  v_br   uuid;
  v_name text;
  v_phone text;
begin
  -- Skip staff registrations
  if (new.raw_user_meta_data->>'is_staff') = 'true' then return new; end if;
  -- Skip if customer record already exists
  if exists (select 1 from public.customers where auth_user_id = new.id) then return new; end if;

  select id into v_br from public.branches where org_id = v_org and is_active = true order by name limit 1;
  v_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''), '');

  insert into public.customers (org_id, branch_id, full_name, phone, email, auth_user_id, city, state, pincode, notes)
  values (v_org, v_br, v_name, v_phone, new.email, new.id, 'Chennai','Tamil Nadu','600037','Auto-created from website portal');

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_auth_to_customer();

-- Backfill: link any existing auth users who don't yet have a customer record
-- (run once manually if you already have website users)
-- DO $$ ... END $$ -- uncomment and run if needed

-- ── Coupons ─────────────────────────────────────────────────────────────────
create table if not exists coupons (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  code         text not null,
  description  text,
  type         text not null default 'percent' check (type in ('percent','fixed')),
  value        numeric(10,2) not null,
  min_order    numeric(10,2) not null default 0,
  max_uses     int,
  uses         int not null default 0,
  per_customer int not null default 1,
  valid_from   date,
  valid_until  date,
  applicable_to text[] default '{}', -- empty = all products
  is_active    boolean not null default true,
  created_at   timestamptz default now(),
  unique (org_id, code)
);
alter table coupons enable row level security;
create policy coupons_staff  on coupons for all  using (org_id = public.current_org());
create policy coupons_public on coupons for select to anon, authenticated using (is_active and (valid_until is null or valid_until >= current_date) and (valid_from is null or valid_from <= current_date));

-- Seed example coupons
insert into coupons (org_id, code, description, type, value, min_order, max_uses, valid_until)
values
  ('00000000-0000-0000-0000-000000000001','POWER10','10% off on all orders','percent',10,0,null,'2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','EYES100','₹100 off on orders above ₹999','fixed',100,999,null,'2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','NEWUSER','₹200 off for new customers','fixed',200,500,1,'2026-12-31'),
  ('00000000-0000-0000-0000-000000000001','FAMILY15','15% off for family plans','percent',15,0,null,'2026-12-31')
on conflict (org_id, code) do nothing;

-- Coupon usage log
create table if not exists coupon_uses (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references coupons(id),
  customer_id uuid references customers(id),
  sale_id     uuid references sales(id),
  discount    numeric(10,2) not null,
  used_at     timestamptz default now()
);
alter table coupon_uses enable row level security;
create policy coupon_uses_staff on coupon_uses for all using (true);

-- ── Referrals ────────────────────────────────────────────────────────────────
create table if not exists referrals (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id),
  referrer_id      uuid not null references customers(id),
  referee_id       uuid references customers(id),
  referee_email    text,
  referral_code    text not null unique,
  status           text not null default 'pending' check (status in ('pending','converted','rewarded')),
  referrer_points  int not null default 200,
  referee_discount int not null default 100,
  converted_at     timestamptz,
  created_at       timestamptz default now()
);
alter table referrals enable row level security;
create policy referrals_staff on referrals for all using (org_id = public.current_org());
create policy referrals_own   on referrals for select to authenticated using (
  referrer_id = (select id from customers where auth_user_id = auth.uid() limit 1) or
  referee_id  = (select id from customers where auth_user_id = auth.uid() limit 1));

-- ── Customer portal columns (safe if already added) ──────────────────────────
alter table customers add column if not exists referral_code text unique;
alter table customers add column if not exists referred_by_customer uuid references customers(id);

-- Auto-generate referral code for existing customers
update customers set referral_code = 'PE'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) where referral_code is null;

-- Function to generate referral code on new customer insert
create or replace function public.set_referral_code() returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := 'PE'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  end if; return new;
end $$;
drop trigger if exists customer_referral_code on public.customers;
create trigger customer_referral_code before insert on public.customers for each row execute function public.set_referral_code();

-- Grant select on coupons to website (anon can check if a coupon is valid)
grant select on coupons to anon, authenticated;
grant all on coupon_uses, referrals to authenticated;
