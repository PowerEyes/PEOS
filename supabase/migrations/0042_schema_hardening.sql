-- ── Migration 0042: Schema hardening — unique constraints, approval gates, missing fields ──

-- 1. Unique constraints on customers (prevent duplicate phone/email)
create unique index if not exists customers_phone_unique 
  on customers (org_id, phone) where phone is not null;
create unique index if not exists customers_email_unique 
  on customers (org_id, email) where email is not null;

-- 2. Prescription approval gate fields
alter table prescriptions
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists review_status text not null default 'pending' 
    check (review_status in ('pending','approved','rejected','correction_requested'));

-- 3. Prism, segment height, fitting height fields on prescriptions
alter table prescriptions
  add column if not exists od_prism numeric(4,2),
  add column if not exists od_base text check (od_base in ('BU','BD','BI','BO')),
  add column if not exists os_prism numeric(4,2),
  add column if not exists os_base text check (os_base in ('BU','BD','BI','BO')),
  add column if not exists segment_height numeric(4,1),
  add column if not exists fitting_height numeric(4,1),
  add column if not exists monocular_pd_far numeric(4,1),
  add column if not exists monocular_pd_near numeric(4,1);

-- 4. Stock reservation concept
alter table stock
  add column if not exists reserved_qty int not null default 0,
  add column if not exists available_qty int generated always as (qty - reserved_qty) stored;

-- 5. Lens package supplier and cost price fields
alter table lens_packages
  add column if not exists supplier_id uuid references suppliers(id),
  add column if not exists cost_price numeric(12,2),
  add column if not exists tier text check (tier in ('good','better','best','premium'));

-- 6. Lens package eligibility fields
alter table lens_packages
  add column if not exists min_frame_height numeric(4,1),
  add column if not exists min_frame_width numeric(4,1);

-- 7. Audit log for prescription approval changes
create table if not exists prescription_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  prescription_id uuid not null references prescriptions(id),
  action text not null check (action in ('created','updated','approved','rejected','corrected','expired')),
  old_values jsonb,
  new_values jsonb,
  performed_by uuid references profiles(id),
  performed_at timestamptz not null default now(),
  reason text
);

alter table prescription_audit_log enable row level security;
create policy pal_select on prescription_audit_log for select using (org_id = public.current_org());
create policy pal_insert on prescription_audit_log for insert with check (org_id = public.current_org());

-- 8. Index for prescription approval queries
create index if not exists idx_prescriptions_review_status on prescriptions (org_id, review_status);
create index if not exists idx_prescriptions_valid_till on prescriptions (org_id, valid_till);

-- 9. Function to check expired prescriptions
create or replace function public.is_prescription_expired(p_rx_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(valid_till < current_date, false) from prescriptions where id = p_rx_id
$$;