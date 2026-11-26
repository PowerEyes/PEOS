-- ── Suppliers ────────────────────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null, gstin text, state text not null default 'Tamil Nadu',
  address text, phone text, email text, contact_person text,
  bank_name text, bank_account text, bank_ifsc text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now());
create index if not exists suppliers_org on suppliers(org_id, status);
alter table suppliers enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='suppliers' and policyname='suppliers_staff') then
    create policy suppliers_staff on suppliers for all using (org_id = public.current_org()); end if; end $$;

-- ── Purchase Invoices ─────────────────────────────────────────────────────────
create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  supplier_id uuid references suppliers(id),
  supplier_name text not null, supplier_gstin text,
  invoice_no text not null, invoice_date date not null, due_date date, po_ref text,
  supply_type text not null default 'intrastate' check (supply_type in ('intrastate','interstate')),
  lines jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  taxable_value numeric(12,2) not null default 0,
  cgst_amount numeric(12,2) not null default 0,
  sgst_amount numeric(12,2) not null default 0,
  igst_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_date date, payment_mode text, payment_ref text,
  itc_eligible boolean not null default true,
  itc_claimed boolean not null default false,
  itc_claim_period text,
  gstr2a_matched boolean not null default false,
  status text not null default 'pending' check (status in ('draft','pending','paid','overdue','cancelled')),
  notes text, attachment_path text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists pi_org_date on purchase_invoices(org_id, invoice_date desc);
create index if not exists pi_org_status on purchase_invoices(org_id, status);
-- 0006_finance_gst already created purchase_invoices with an older shape, so the
-- CREATE TABLE above was skipped on an existing database. Bring that table up to
-- the shape the view and triggers below expect.
alter table purchase_invoices add column if not exists due_date date;
alter table purchase_invoices add column if not exists po_ref text;
alter table purchase_invoices add column if not exists lines jsonb not null default '[]';
alter table purchase_invoices add column if not exists taxable_value numeric(12,2) not null default 0;
alter table purchase_invoices add column if not exists cgst_amount numeric(12,2) not null default 0;
alter table purchase_invoices add column if not exists sgst_amount numeric(12,2) not null default 0;
alter table purchase_invoices add column if not exists igst_amount numeric(12,2) not null default 0;
alter table purchase_invoices add column if not exists paid_amount numeric(12,2) not null default 0;
alter table purchase_invoices add column if not exists payment_date date;
alter table purchase_invoices add column if not exists payment_mode text;
alter table purchase_invoices add column if not exists payment_ref text;
alter table purchase_invoices add column if not exists itc_eligible boolean not null default true;
alter table purchase_invoices add column if not exists itc_claimed boolean not null default false;
alter table purchase_invoices add column if not exists itc_claim_period text;
alter table purchase_invoices add column if not exists gstr2a_matched boolean not null default false;
alter table purchase_invoices add column if not exists attachment_path text;
alter table purchase_invoices add column if not exists created_by uuid references profiles(id);
alter table purchase_invoices add column if not exists updated_at timestamptz not null default now();
-- widen the legacy status check ('unpaid','paid') to the full lifecycle
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'purchase_invoices'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%';
  if c is not null then execute format('alter table purchase_invoices drop constraint %I', c); end if;
end $$;
alter table purchase_invoices
  add constraint purchase_invoices_status_check
  check (status in ('unpaid','paid','draft','pending','overdue','cancelled'));
alter table purchase_invoices enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='purchase_invoices' and policyname='pi_staff') then
    create policy pi_staff on purchase_invoices for all using (org_id = public.current_org()); end if; end $$;

create or replace function public.touch_pi_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists pi_touch on purchase_invoices;
create trigger pi_touch before update on purchase_invoices for each row execute function public.touch_pi_updated();

create or replace view public.itc_summary as
  select org_id, to_char(invoice_date,'YYYY-MM') as period,
    count(*)::int as invoice_count,
    sum(grand_total)::numeric(14,2) as total_purchases,
    sum(case when itc_eligible then cgst_amount else 0 end)::numeric(14,2) as eligible_cgst,
    sum(case when itc_eligible then sgst_amount else 0 end)::numeric(14,2) as eligible_sgst,
    sum(case when itc_eligible then igst_amount else 0 end)::numeric(14,2) as eligible_igst,
    sum(case when itc_eligible then cgst_amount+sgst_amount+igst_amount else 0 end)::numeric(14,2) as total_itc,
    sum(case when itc_claimed then cgst_amount+sgst_amount+igst_amount else 0 end)::numeric(14,2) as claimed_itc
  from purchase_invoices where status != 'cancelled'
  group by org_id, to_char(invoice_date,'YYYY-MM');
grant select on public.itc_summary to authenticated;
