-- ─── Fix: POS cannot place an order — sales.patient_customer_id ────────────────────
--
-- Symptom at the counter: pressing Pay in the POS returns
--   "That field could not be saved — the app may be out of date.
--    Reload the page and try again."
-- for every order, so no sale can be created.
--
-- Cause: sales.patient_customer_id and lab_orders.patient_customer_id exist in the
-- database as NOT NULL with no default, but nothing ever writes them — place_sale()
-- (the one RPC every POS and website order goes through) does not list them in its
-- INSERT. Postgres therefore rejects the very first statement of place_sale with
--
--   null value in column "patient_customer_id" of relation "sales"
--   violates not-null constraint
--
-- and errors.ts maps `column "..." of relation` to the message above, which is why
-- a not-null violation is reported as a stale-schema problem.
--
-- The patient is the person the lenses are for. At the counter that is the customer
-- the sale is being rung up for, which is exactly the value the pre-existing sales
-- rows already hold (patient_customer_id = customer_id on ORD-0001..0004). So the
-- column is back-filled rather than relaxed: the NOT NULL invariant stays true for
-- every writer — place_sale today, and any direct insert tomorrow — without having
-- to keep editing the place_sale body (it is rewritten by several migrations).

create or replace function public.fill_patient_customer_id() returns trigger
language plpgsql as $$
begin
  new.patient_customer_id := coalesce(new.patient_customer_id, new.customer_id);
  return new;
end $$;

-- Postgres has no CREATE TRIGGER IF NOT EXISTS, hence the DO block.
do $$
begin
  drop trigger if exists trg_sales_patient on sales;
  create trigger trg_sales_patient
    before insert on sales
    for each row execute function public.fill_patient_customer_id();

  drop trigger if exists trg_lab_orders_patient on lab_orders;
  create trigger trg_lab_orders_patient
    before insert on lab_orders
    for each row execute function public.fill_patient_customer_id();
end $$;
