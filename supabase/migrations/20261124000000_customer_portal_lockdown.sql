-- Customer portal lockdown.
-- 1) One login <-> one customer row (a customer row can never be shared by two logins).
create unique index if not exists customers_auth_user_uq on customers (auth_user_id) where auth_user_id is not null;

-- 2) cust_self_update lets a website customer UPDATE their own row, which until now included identity/ownership
--    columns (auth_user_id, org_id, codes, status, tags, notes, referral links). Freeze those for non-staff.
create or replace function public.customers_protect_cols() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('role', true) = 'service_role' then return new; end if;   -- server/service paths
  if public.current_org() is not null then return new; end if;                                       -- approved staff
  if new.auth_user_id is distinct from old.auth_user_id or new.org_id is distinct from old.org_id
     or new.customer_code is distinct from old.customer_code or new.vision_id is distinct from old.vision_id
     or new.status is distinct from old.status or new.tags is distinct from old.tags
     or new.notes is distinct from old.notes or new.branch_id is distinct from old.branch_id
     or new.referral_code is distinct from old.referral_code or new.referred_by_customer is distinct from old.referred_by_customer
     or new.gstin is distinct from old.gstin or new.created_at is distinct from old.created_at then
    raise exception 'These customer fields can only be changed by the store';
  end if;
  return new;
end $$;
drop trigger if exists trg_customers_protect_cols on customers;
create trigger trg_customers_protect_cols before update on customers for each row execute function public.customers_protect_cols();
