-- PowerOS foundation: tenancy, branches, approved staff, customers, audit
create table organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  code text not null, name text not null, address text, phone text, is_active boolean default true,
  unique (org_id, code));
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  full_name text, role_key text not null default 'staff',
  is_approved boolean not null default false,   -- a valid login is NOT enough; staff must be approved
  created_at timestamptz default now());
create table counters (org_id uuid, key text, value int not null default 0, primary key (org_id, key));

create function public.current_org() returns uuid language sql stable security definer set search_path = public as
$$ select org_id from profiles where id = auth.uid() and is_approved $$;

create function public.next_code(p_org uuid, p_key text, p_prefix text) returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into counters(org_id,key,value) values (p_org,p_key,1)
  on conflict (org_id,key) do update set value = counters.value + 1 returning value into n;
  return p_prefix || lpad(n::text, 4, '0');
end $$;

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid references branches(id),
  customer_code text, vision_id text,           -- permanent, assigned once by trigger
  full_name text not null, phone text not null, whatsapp text, email text,
  referred_by_doctor text, gender text check (gender in ('male','female')), dob date,
  address_line1 text, address_line2 text, landmark text, city text, state text, pincode text,
  notes text check (char_length(notes) <= 500), tags text[] default '{}',
  status text not null default 'active', created_at timestamptz default now(),
  unique (org_id, customer_code), unique (org_id, vision_id));
create index on customers (org_id, full_name);
create index on customers (org_id, phone);

create function customers_assign_codes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.customer_code := public.next_code(new.org_id,'customer','CUS-');
  new.vision_id     := public.next_code(new.org_id,'vision','VIS-');
  return new;
end $$;
create trigger trg_customers_codes before insert on customers for each row execute function customers_assign_codes();

create table audit_log (
  id bigserial primary key, org_id uuid, user_id uuid default auth.uid(),
  table_name text, row_id uuid, action text, old_data jsonb, new_data jsonb, at timestamptz default now());
create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(org_id,table_name,row_id,action,old_data,new_data)
  values (coalesce(new.org_id,old.org_id), tg_table_name, coalesce(new.id,old.id), tg_op,
          case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
create trigger trg_customers_audit after insert or update or delete on customers for each row execute function audit_row();

-- RLS: everything scoped to the approved user's organization
alter table organizations enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table audit_log enable row level security;
alter table counters enable row level security;

create policy org_read on organizations for select using (id = public.current_org());
create policy branch_read on branches for select using (org_id = public.current_org());
create policy profile_self on profiles for select using (id = auth.uid() or org_id = public.current_org());
create policy cust_select on customers for select using (org_id = public.current_org());
create policy cust_insert on customers for insert with check (org_id = public.current_org());
create policy cust_update on customers for update using (org_id = public.current_org()) with check (org_id = public.current_org());
create policy audit_read on audit_log for select using (org_id = public.current_org() and exists (select 1 from profiles where id=auth.uid() and role_key in ('owner','admin')));

-- every new login gets an UNAPPROVED profile
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Demo tenant: every seeded row in the migrations below belongs to this fixed
-- organisation, so it has to exist before them. Idempotent — a database that
-- already has it (the live deployment) is untouched.
insert into organizations (id, name) values ('00000000-0000-0000-0000-000000000001', 'Power Eyes Opticals')
on conflict (id) do nothing;
insert into branches (org_id, code, name) values ('00000000-0000-0000-0000-000000000001', 'MAIN', 'Mogappair East')
on conflict (org_id, code) do nothing;
