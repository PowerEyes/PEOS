-- Website customers must be able to read/update their own customers row.
--
-- Migration 0001 only granted `org_id = public.current_org()`, which resolves
-- via the profiles table and is therefore NULL for non-staff website logins.
-- Every portal page calls getCustomer() -> `customers where auth_user_id =
-- auth.uid()`, and the customer-read policies on sales/prescriptions/
-- appointments/loyalty_ledger all depend on that same subquery — so without
-- this policy the whole /my/* portal bounced users back to /my/login.

create policy cust_self_select on customers
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy cust_self_update on customers
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

comment on policy cust_self_select on customers is
  'A logged-in website customer can read their own profile row';
comment on policy cust_self_update on customers is
  'A logged-in website customer can edit their own profile row';
