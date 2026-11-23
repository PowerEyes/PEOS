-- Website-portal signups often arrive with no phone number, and sync_auth_to_customer()
-- stores the empty string (customers.phone is NOT NULL, so it cannot store NULL).
-- Migration 0042 made (org_id, phone) unique for every non-null value, which meant the
-- SECOND phone-less signup in an organisation failed with a duplicate-key error — the
-- auth insert itself was rejected. Keep the duplicate guard where it matters (real
-- phone numbers) and ignore the "unknown" placeholder value.
drop index if exists public.customers_phone_unique;
create unique index if not exists customers_phone_unique
  on public.customers (org_id, phone)
  where phone is not null and phone <> '';
