-- Loyalty rules enforced in the database (the POS used to be the only guard):
--  * points never go below zero; changes are serialised per customer
--  * one 'purchase' earning per sale
--  * manual/birthday/referral grants (positive points not tied to a sale) need manager rights
--  * sane size per entry
create unique index if not exists loyalty_one_purchase_per_sale on public.loyalty_ledger (customer_id, ref_id) where reason = 'purchase' and ref_id is not null;

create or replace function public.loyalty_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  if new.delta = 0 or abs(new.delta) > 100000 then raise exception 'Loyalty points change must be between 1 and 100000'; end if;
  if new.delta > 0 and new.reason in ('manual','birthday','referral') and auth.uid() is not null and not public.is_manager() then
    raise exception 'Only a manager can grant loyalty points manually'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 7));
  select coalesce(sum(delta), 0) into v_bal from public.loyalty_ledger where customer_id = new.customer_id;
  if v_bal + new.delta < 0 then raise exception 'Not enough loyalty points (balance %)', v_bal; end if;
  return new;
end $$;
revoke execute on function public.loyalty_guard() from public, anon;
drop trigger if exists loyalty_guard on public.loyalty_ledger;
create trigger loyalty_guard before insert on public.loyalty_ledger for each row execute function public.loyalty_guard();
