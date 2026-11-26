-- ── Repairs ──────────────────────────────────────────────────────────────────
create table repairs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  code text,
  customer_id uuid references customers(id),
  referred_by text,
  item_brand text, item_model text,
  item_type text check (item_type in ('Spectacle Frame','Sunglasses','Contact Lens Pack','Accessory','Other')),
  item_color text, frame_no text,
  problem text not null,
  technician_notes text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','ready','delivered','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assigned_to text, due_date date,
  repair_charges numeric(10,2) not null default 0,
  parts_cost numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax_pct numeric(4,1) not null default 0,
  total_amount numeric(10,2) not null default 0,
  paid boolean not null default false, paid_method text,
  sale_id uuid references sales(id),   -- if a repair becomes a paid job it links here
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (org_id, code));
create index on repairs (org_id, status);
create index on repairs (org_id, customer_id);

create table repair_events (
  id bigserial primary key,
  org_id uuid not null default public.current_org() references organizations(id),
  repair_id uuid not null references repairs(id) on delete cascade,
  from_status text, to_status text not null,
  note text, by_user uuid default auth.uid(), at timestamptz default now());

create function repairs_before() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.code := public.next_code(new.org_id,'repair','REP-');
  else new.code := old.code; new.updated_at := now(); end if;
  new.total_amount := round((new.repair_charges + new.parts_cost - new.discount) * (1 + new.tax_pct/100), 2);
  return new;
end $$;
create trigger trg_repairs_before before insert or update on repairs for each row execute function repairs_before();
create trigger trg_repairs_audit after insert or update on repairs for each row execute function audit_row();

create function advance_repair(p_id uuid, p_to text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r repairs%rowtype;
begin
  if public.current_org() is null then raise exception 'Only approved staff can update repairs'; end if;
  select * into r from repairs where id = p_id and org_id = public.current_org() for update;
  if not found then raise exception 'Repair not found'; end if;
  if not ((r.status,p_to) in (('pending','in_progress'),('in_progress','ready'),('ready','delivered'),('pending','cancelled'),('in_progress','cancelled'),('ready','cancelled')))
    then raise exception 'Cannot move repair from % to %', r.status, p_to; end if;
  update repairs set status = p_to where id = p_id;
  insert into repair_events (org_id,repair_id,from_status,to_status,note) values (r.org_id,p_id,r.status,p_to,nullif(trim(coalesce(p_note,'')),''));
end $$;

-- ── Appointments ─────────────────────────────────────────────────────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid not null references branches(id),
  customer_id uuid not null references customers(id),
  appt_type text not null default 'Eye Test'
    check (appt_type in ('Eye Test','Contact Lens Fitting','Follow Up','Consultation','Other')),
  appt_date date not null, appt_time time not null,
  duration_mins int not null default 30,
  optometrist text, notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','arrived','completed','cancelled','no_show')),
  created_at timestamptz default now(), updated_at timestamptz default now());
create index on appointments (org_id, appt_date, status);
create index on appointments (org_id, customer_id);

-- ── Staff profiles enrichment ─────────────────────────────────────────────────
alter table profiles add column if not exists branch_id uuid references branches(id);
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists deactivated boolean not null default false;

-- RLS
do $$ declare t text; begin
  foreach t in array array['repairs','repair_events','appointments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (org_id = public.current_org())', t||'_s', t);
    execute format('create policy %I on %I for insert with check (org_id = public.current_org())', t||'_i', t);
  end loop;
  foreach t in array array['repairs','appointments'] loop
    execute format('create policy %I on %I for update using (org_id = public.current_org()) with check (org_id = public.current_org())', t||'_u', t);
  end loop;
  create policy repairs_del on repairs for delete using (org_id = public.current_org() and status = 'pending');
end $$;
