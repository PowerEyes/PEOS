-- ── Eye Examination records ───────────────────────────────────────────────────
create table if not exists eye_examinations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id),
  branch_id       uuid references branches(id),
  customer_id     uuid not null references customers(id),
  appointment_id  uuid references appointments(id),
  examiner_name   text,

  -- Unaided visual acuity
  va_od_dist_ua   text,  -- e.g. "6/60", "6/18", "6/6"
  va_os_dist_ua   text,
  va_od_near_ua   text,  -- e.g. "N36", "N12", "N6"
  va_os_near_ua   text,

  -- Aided visual acuity (with existing correction)
  va_od_dist_a    text,
  va_os_dist_a    text,
  va_od_near_a    text,
  va_os_near_a    text,

  -- Auto-refractor readings
  ar_od_sph       numeric(5,2), ar_od_cyl numeric(5,2), ar_od_axis int,
  ar_os_sph       numeric(5,2), ar_os_cyl numeric(5,2), ar_os_axis int,

  -- Final subjective refraction (auto-fills prescription)
  od_sph          numeric(5,2), od_cyl numeric(5,2), od_axis int,
  od_add          numeric(4,2), od_va text,
  os_sph          numeric(5,2), os_cyl numeric(5,2), os_axis int,
  os_add          numeric(4,2), os_va text,
  pd_far          numeric(4,1), pd_near numeric(4,1),

  -- Clinical findings
  cover_test      text default 'orthophoria',
  iop_od          numeric(4,1), iop_os numeric(4,1),
  colour_vision   text default 'normal',
  confrontation   text default 'full',
  anterior_od     text default 'clear', anterior_os text default 'clear',
  fundus_od       text, fundus_os text,
  disc_od         text, disc_os text,
  cup_disc_od     text, cup_disc_os text,
  macula_od       text, macula_os text,
  vessels_od      text, vessels_os text,

  -- Recommendations
  rx_type         text,  -- single_vision, progressive, bifocal, reading, nil
  recommended_index numeric(4,2),
  lens_recommendation text,
  notes           text,
  next_review_months int default 24,

  -- Link to auto-created prescription
  prescription_id uuid references prescriptions(id),

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table eye_examinations enable row level security;
create policy eye_exam_staff on eye_examinations for all using (org_id = public.current_org());
-- Customer can read their own exams
create policy eye_exam_customer on eye_examinations for select to authenticated
  using (customer_id in (select id from customers where auth_user_id = auth.uid()));

-- ── Loyalty rules table (configurable earn/redeem rates) ──────────────────────
create table if not exists loyalty_rules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) unique,
  earn_rate   int not null default 10,   -- points per ₹100 spent
  redeem_rate int not null default 100,  -- points needed for ₹10 discount
  min_redeem  int not null default 100,  -- minimum points to redeem at once
  max_redeem_pct int not null default 20, -- max % of bill that can be paid in points
  updated_at  timestamptz default now()
);
alter table loyalty_rules enable row level security;
create policy loyalty_rules_staff on loyalty_rules for all using (org_id = public.current_org());

-- Seed default rules
insert into loyalty_rules (org_id, earn_rate, redeem_rate, min_redeem, max_redeem_pct)
values ('00000000-0000-0000-0000-000000000001', 10, 100, 100, 20)
on conflict (org_id) do nothing;

-- ── Loyalty ledger (ensure it exists) ─────────────────────────────────────────
create table if not exists loyalty_ledger (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id),
  customer_id uuid not null references customers(id),
  delta       int  not null,              -- +ve = earned, -ve = redeemed/expired
  reason      text not null,             -- 'purchase', 'referral', 'birthday', 'redemption', 'manual'
  ref_id      uuid,                       -- sale_id or other reference
  staff_note  text,
  created_at  timestamptz default now()
);
alter table loyalty_ledger enable row level security;
create policy loyalty_ledger_staff on loyalty_ledger for all using (org_id = public.current_org());
create policy loyalty_ledger_customer on loyalty_ledger for select to authenticated
  using (customer_id in (select id from customers where auth_user_id = auth.uid()));

create index if not exists idx_loyalty_customer on loyalty_ledger(customer_id);
create index if not exists idx_loyalty_created on loyalty_ledger(created_at desc);

-- ── GSTIN column on customers (for GSTR-1 B2B) ───────────────────────────────
alter table customers add column if not exists gstin text;
alter table customers add column if not exists state_code text;
