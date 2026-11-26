-- ── Purchase Orders (PO → approve → goods receipt → stock + purchase invoice) ──
-- The PO is the ordering document; the goods receipt (GRN) is what moves stock
-- and books the supplier liability as a purchase invoice.

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  po_no text not null,
  branch_id uuid not null references branches(id),
  supplier_id uuid references suppliers(id),
  supplier_name text not null,
  supplier_gstin text,
  order_date date not null default current_date,
  expected_date date,
  supply_type text not null default 'intrastate' check (supply_type in ('intrastate','interstate')),
  -- [{product_id, sku, description, hsn, qty, rate, tax_pct, received_qty}]
  lines jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  taxable_value numeric(12,2) not null default 0,
  cgst_amount numeric(12,2) not null default 0,
  sgst_amount numeric(12,2) not null default 0,
  igst_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','approved','partially_received','received','cancelled')),
  approved_at timestamptz, received_at timestamptz, cancelled_at timestamptz,
  invoice_id uuid references purchase_invoices(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, po_no)
);
create index if not exists po_org_status on purchase_orders(org_id, status);
create index if not exists po_org_date on purchase_orders(org_id, order_date desc);
create index if not exists po_org_supplier on purchase_orders(org_id, supplier_id);

comment on column purchase_orders.lines is
  'Array of {product_id, sku, description, hsn, qty, rate, tax_pct, received_qty}. received_qty is the quantity already booked by goods receipts.';

-- PO number, same counter scheme as SKUs / customers / credit notes.
create or replace function public.purchase_orders_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.po_no is null or new.po_no = '' then
    new.po_no := public.next_code(new.org_id, 'purchase_order', 'PO-');
  end if;
  return new;
end $$;
drop trigger if exists trg_po_no on purchase_orders;
create trigger trg_po_no before insert on purchase_orders
  for each row execute function public.purchase_orders_no();

create or replace function public.touch_po_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_po_touch on purchase_orders;
create trigger trg_po_touch before update on purchase_orders
  for each row execute function public.touch_po_updated();

create trigger trg_po_audit after insert or update or delete on purchase_orders
  for each row execute function audit_row();

-- ── Goods receipts (the GRN audit trail) ─────────────────────────────────────
create table if not exists purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  branch_id uuid not null references branches(id),
  -- [{product_id, qty, rate}]
  lines jsonb not null default '[]',
  note text,
  received_by uuid default auth.uid(),
  received_at timestamptz not null default now()
);
create index if not exists por_org_po on purchase_order_receipts(org_id, po_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table purchase_orders enable row level security;
alter table purchase_order_receipts enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='purchase_orders' and policyname='po_staff') then
    create policy po_staff on purchase_orders for all
      using (org_id = public.current_org()) with check (org_id = public.current_org()); end if;
  if not exists(select 1 from pg_policies where tablename='purchase_order_receipts' and policyname='por_staff') then
    create policy por_staff on purchase_order_receipts for all
      using (org_id = public.current_org()) with check (org_id = public.current_org()); end if;
end $$;

-- Ordered value that has not been received yet (open commitment).
create or replace view public.open_po_value as
  select org_id, branch_id, supplier_id,
    count(*)::int as open_po_count,
    sum(grand_total)::numeric(14,2) as ordered_value
  from purchase_orders
  where status in ('draft','approved','partially_received')
  group by org_id, branch_id, supplier_id;
grant select on public.open_po_value to authenticated;
