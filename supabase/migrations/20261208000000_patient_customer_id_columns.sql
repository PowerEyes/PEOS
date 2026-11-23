-- The back-fill trigger from 20261125010000 writes sales.patient_customer_id and
-- lab_orders.patient_customer_id, but no migration in this repo ever creates those
-- columns: on a fresh database the BEFORE INSERT trigger therefore raises
--   record "new" has no field "patient_customer_id"
-- and every POS sale, website order and lab order is rejected. (In the environment
-- that migration was written against, the columns already existed.)
--
-- Create them when missing, copy the value the trigger would have derived, then hold
-- the NOT NULL invariant the original schema had. customer_id is NOT NULL on both
-- tables, so the back-fill always succeeds.
alter table public.sales
  add column if not exists patient_customer_id uuid references public.customers(id) on delete set null;
alter table public.lab_orders
  add column if not exists patient_customer_id uuid references public.customers(id) on delete set null;

update public.sales
   set patient_customer_id = customer_id
 where patient_customer_id is null and patient_customer_id is distinct from customer_id;
update public.lab_orders
   set patient_customer_id = customer_id
 where patient_customer_id is null and patient_customer_id is distinct from customer_id;

alter table public.sales alter column patient_customer_id set not null;
alter table public.lab_orders alter column patient_customer_id set not null;
