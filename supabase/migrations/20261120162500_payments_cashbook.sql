-- ─── 30. Payments ledger (cashbook) ─────────────────────────────────────────
-- One append-only ledger for every rupee that moves, so Finance has a single
-- place to see money in / money out no matter where the payment was taken:
--
--   source            direction  written by
--   sale_payment      in         payments          (POS "Add payment", place_sale)
--   online_payment    in         online_payments   (Razorpay receipts with no sale)
--   expense           out        expenses          (Finance > Add expense)
--   purchase_payment  out        purchase_invoices (Purchase Invoices > Record payment)
--   refund            out        credit_notes      (Finance > Issue credit note)
--
-- Deliberate exclusions, so nothing is counted twice or mis-stated:
--   * online_payments rows that carry a sale_id are NOT posted. order-confirm
--     calls place_sale (which writes a `payments` row) and then inserts the
--     online payment in the same request, so posting both would double-count.
--     Only orphan receipts — the webhook firing because the browser never came
--     back — are posted.
--   * Refunds issued in store credit are NOT posted. No cash leaves the till;
--     they still appear under Finance > Credit Notes.
--
-- Ledger rows are written only by the security-definer triggers below. There is
-- no insert/update/delete policy on purpose: staff can read the ledger but
-- cannot author entries into it.

create table cashbook (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid references branches(id),
  direction text not null check (direction in ('in','out')),
  source text not null check (source in ('sale_payment','online_payment','expense','purchase_payment','refund')),
  source_id uuid not null,
  entry_no int not null default 1,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','upi','card','bank','razorpay','other')),
  category text,
  party text,
  doc_code text,
  reference text,
  memo text,
  sale_id uuid references sales(id),
  occurred_on date not null,
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (org_id, source, source_id, entry_no)
);

create index cashbook_day_idx on cashbook (org_id, occurred_on desc);
create index cashbook_method_idx on cashbook (org_id, method, occurred_on desc);
create index cashbook_source_idx on cashbook (org_id, source, source_id);

alter table cashbook enable row level security;
create policy cashbook_s on cashbook for select using (org_id = public.current_org());

-- One vocabulary for methods. Several tables carry their own free-text labels —
-- Purchase Invoices uses "Bank Transfer", "NEFT/RTGS", "Cheque" — so everything
-- is normalised before it reaches the ledger. Pure and side-effect free, so it
-- is safe to expose.
create or replace function public.cashbook_method(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when lower(coalesce(p,'')) = 'cash' then 'cash'
    when lower(coalesce(p,'')) in ('upi','upi/vpa','upi transfer') then 'upi'
    when lower(coalesce(p,'')) in ('card','credit card','debit card','cc','dc') then 'card'
    when lower(coalesce(p,'')) in ('bank','bank transfer','neft/rtgs','neft','rtgs','imps','cheque','check','transfer') then 'bank'
    when lower(coalesce(p,'')) in ('razorpay','online','gateway') then 'razorpay'
    else 'other'
  end $$;

-- ─── Triggers ───────────────────────────────────────────────────────────────
-- These are plpgsql trigger functions, which PostgreSQL refuses to let anyone
-- call directly ("trigger functions can only be called as triggers"), so the
-- security-definer body cannot be reached from PostgREST or from a SQL console
-- as a normal user. `on conflict ... do nothing` keeps every entry idempotent.

create or replace function public.cashbook_from_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_branch uuid; v_code text; v_party text;
begin
  select s.branch_id, s.code, c.full_name into v_branch, v_code, v_party
    from sales s left join customers c on c.id = s.customer_id where s.id = new.sale_id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, sale_id, occurred_on, occurred_at, created_by)
  values (new.org_id, v_branch, 'in', 'sale_payment', new.id, new.amount, public.cashbook_method(new.method),
          'Sale payment', v_party, v_code, nullif(new.reference,''), new.sale_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at, new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;
create trigger trg_cashbook_payment after insert on payments
  for each row execute function public.cashbook_from_payment();

create or replace function public.cashbook_from_expense() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, doc_code, reference, memo, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'expense', new.id, new.amount, public.cashbook_method(new.payment_method),
          new.category, null, nullif(new.reference,''), new.description,
          new.expense_date, timezone('Asia/Kolkata', new.expense_date::timestamp), new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;
create trigger trg_cashbook_expense after insert on expenses
  for each row execute function public.cashbook_from_expense();

-- paid_amount is a running total, so the ledger posts the delta: paying 100
-- today and 200 tomorrow becomes two entries, not one row for 300.
create or replace function public.cashbook_from_purchase() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_delta numeric; v_no int;
begin
  v_delta := coalesce(new.paid_amount,0) - case when tg_op = 'INSERT' then 0 else coalesce(old.paid_amount,0) end;
  if v_delta <= 0 then return new; end if;

  select coalesce(max(entry_no),0) + 1 into v_no from cashbook
    where org_id = new.org_id and source = 'purchase_payment' and source_id = new.id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, entry_no, amount, method,
                        category, party, doc_code, reference, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'purchase_payment', new.id, v_no, v_delta,
          public.cashbook_method(new.payment_mode), 'Supplier payment', new.supplier_name, new.invoice_no,
          nullif(new.payment_ref,''),
          coalesce(new.payment_date, (now() at time zone 'Asia/Kolkata')::date), now(), new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;
create trigger trg_cashbook_purchase after insert or update on purchase_invoices
  for each row execute function public.cashbook_from_purchase();

create or replace function public.cashbook_from_credit_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_m text; v_party text;
begin
  -- create_credit_note() inserts the header with grand_total = 0 and fills the
  -- totals in afterwards, so the money only exists on the UPDATE that follows.
  if coalesce(new.grand_total,0) <= 0 then return new; end if;
  v_m := public.cashbook_method(new.refund_method);
  if v_m = 'other' then return new; end if;  -- store credit / unlabelled: no cash moved

  select c.full_name into v_party from customers c where c.id = new.customer_id;

  insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, memo, sale_id, occurred_on, occurred_at, created_by)
  values (new.org_id, new.branch_id, 'out', 'refund', new.id, new.grand_total, v_m,
          'Refund', v_party, new.code, nullif(new.reason,''), null, new.original_sale_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at, new.created_by)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;
create trigger trg_cashbook_credit_note after insert or update on credit_notes
  for each row execute function public.cashbook_from_credit_note();

create or replace function public.cashbook_from_online() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_party text;
begin
  if new.sale_id is not null then return new; end if;   -- already posted via `payments`
  if coalesce(new.status,'') <> 'paid' then return new; end if;

  select c.full_name into v_party from customers c where c.id = new.customer_id;

  insert into cashbook (org_id, direction, source, source_id, amount, method,
                        category, party, doc_code, reference, occurred_on, occurred_at)
  values (new.org_id, 'in', 'online_payment', new.id, new.amount, 'razorpay',
          'Online payment', v_party, new.razorpay_order_id, new.razorpay_payment_id,
          (new.created_at at time zone 'Asia/Kolkata')::date, new.created_at)
  on conflict (org_id, source, source_id, entry_no) do nothing;
  return new;
end $$;
create trigger trg_cashbook_online after insert on online_payments
  for each row execute function public.cashbook_from_online();

-- ─── Backfill ───────────────────────────────────────────────────────────────
-- Existing history is posted with the same rules the triggers use, so the
-- ledger is complete from day one. The triggers above do not fire for rows
-- that already existed, and `on conflict ... do nothing` makes a re-run safe.

insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                      category, party, doc_code, reference, sale_id, occurred_on, occurred_at, created_by)
select p.org_id, s.branch_id, 'in', 'sale_payment', p.id, p.amount, public.cashbook_method(p.method),
       'Sale payment', c.full_name, s.code, nullif(p.reference,''), p.sale_id,
       (p.created_at at time zone 'Asia/Kolkata')::date, p.created_at, p.created_by
  from payments p join sales s on s.id = p.sale_id left join customers c on c.id = s.customer_id
on conflict (org_id, source, source_id, entry_no) do nothing;

insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                      category, doc_code, reference, memo, occurred_on, occurred_at, created_by)
select e.org_id, e.branch_id, 'out', 'expense', e.id, e.amount, public.cashbook_method(e.payment_method),
       e.category, null, nullif(e.reference,''), e.description,
       e.expense_date, timezone('Asia/Kolkata', e.expense_date::timestamp), e.created_by
  from expenses e
on conflict (org_id, source, source_id, entry_no) do nothing;

insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                      category, party, doc_code, reference, occurred_on, occurred_at, created_by)
select i.org_id, i.branch_id, 'out', 'purchase_payment', i.id, i.paid_amount, public.cashbook_method(i.payment_mode),
       'Supplier payment', i.supplier_name, i.invoice_no, nullif(i.payment_ref,''),
       coalesce(i.payment_date, (i.created_at at time zone 'Asia/Kolkata')::date), i.created_at, i.created_by
  from purchase_invoices i
 where coalesce(i.paid_amount,0) > 0
on conflict (org_id, source, source_id, entry_no) do nothing;

insert into cashbook (org_id, branch_id, direction, source, source_id, amount, method,
                      category, party, doc_code, reference, memo, sale_id, occurred_on, occurred_at, created_by)
select n.org_id, n.branch_id, 'out', 'refund', n.id, n.grand_total, public.cashbook_method(n.refund_method),
       'Refund', c.full_name, n.code, nullif(n.reason,''), null, n.original_sale_id,
       (n.created_at at time zone 'Asia/Kolkata')::date, n.created_at, n.created_by
  from credit_notes n left join customers c on c.id = n.customer_id
 where coalesce(n.grand_total,0) > 0
   and public.cashbook_method(n.refund_method) <> 'other'
on conflict (org_id, source, source_id, entry_no) do nothing;

insert into cashbook (org_id, direction, source, source_id, amount, method,
                      category, party, doc_code, reference, occurred_on, occurred_at)
select o.org_id, 'in', 'online_payment', o.id, o.amount, 'razorpay',
       'Online payment', c.full_name, o.razorpay_order_id, o.razorpay_payment_id,
       (o.created_at at time zone 'Asia/Kolkata')::date, o.created_at
  from online_payments o left join customers c on c.id = o.customer_id
 where o.sale_id is null and o.status = 'paid'
on conflict (org_id, source, source_id, entry_no) do nothing;
