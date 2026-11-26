-- PowerOS 0017: staff signups must land in profiles as PENDING so an owner can
-- approve them from PowerOS -> Staff (SETUP.md steps 7-8, /staff page).
--
-- Migration 0013 made the auth trigger create customer records for website
-- signups and *skip* staff signups entirely, which left new ERP "Request access"
-- signups with no profiles row at all: they could log in but never appear in
-- Staff -> Pending, and current_org() stayed null forever.
--
-- Contract (documented in 0013):
--   raw_user_meta_data.is_staff = 'true'  -> pending staff profile
--   otherwise                             -> website customer record
create or replace function public.sync_auth_to_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid := '00000000-0000-0000-0000-000000000001';
  v_br   uuid;
  v_name text;
  v_phone text;
begin
  -- Staff registration (PowerOS "Request access") -> pending profile
  if (new.raw_user_meta_data->>'is_staff') = 'true' then
    insert into public.profiles (id, full_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
  end if;

  -- Website registration -> customer record
  if exists (select 1 from public.customers where auth_user_id = new.id) then return new; end if;

  select id into v_br from public.branches where org_id = v_org and is_active = true order by name limit 1;
  v_name  := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1), 'Customer');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'),''), '');

  insert into public.customers (org_id, branch_id, full_name, phone, email, auth_user_id, city, state, pincode, notes)
  values (v_org, v_br, v_name, v_phone, new.email, new.id, 'Chennai','Tamil Nadu','600037','Auto-created from website portal');

  return new;
end $$;
