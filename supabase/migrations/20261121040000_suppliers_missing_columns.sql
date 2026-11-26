-- suppliers was created by 0006_finance_gst.sql, so 0011's
-- `create table if not exists suppliers (...)` was a no-op and the columns it
-- declared were never added. The ERP's supplier form and list select
-- contact_person (and the table definition in 0011 declares the bank fields),
-- so PostgREST rejected every supplier write with
-- `column "contact_person" of relation "suppliers" does not exist`.

alter table suppliers
  add column if not exists contact_person text,
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists bank_ifsc text;

create index if not exists suppliers_org on suppliers(org_id, status);
