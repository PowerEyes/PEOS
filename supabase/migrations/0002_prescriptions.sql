alter table branches add column if not exists email text, add column if not exists udyam_no text;

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org() references organizations(id),
  branch_id uuid references branches(id),
  customer_id uuid not null references customers(id),
  rx_code text, rx_date timestamptz not null default now(), valid_till date, examined_by text,
  rx_type text not null default 'Spectacle', purpose text not null default 'Distance',
  od_sph numeric(4,2), od_cyl numeric(4,2), od_axis int check (od_axis between 0 and 180), od_add numeric(4,2), od_va_dist text, od_va_near text,
  os_sph numeric(4,2), os_cyl numeric(4,2), os_axis int check (os_axis between 0 and 180), os_add numeric(4,2), os_va_dist text, os_va_near text,
  pd_far numeric(4,1), pd_near numeric(4,1), remarks text,
  source text not null default 'manual' check (source in ('manual','ocr')), image_path text,
  status text not null default 'active', created_by uuid default auth.uid(), created_at timestamptz default now(),
  unique (org_id, rx_code));
create index on prescriptions (org_id, customer_id, rx_date desc);

create function prescriptions_assign_code() returns trigger language plpgsql security definer set search_path = public as $$
begin new.rx_code := public.next_code(new.org_id,'rx','RX-'); return new; end $$;
create trigger trg_rx_code before insert on prescriptions for each row execute function prescriptions_assign_code();
create trigger trg_rx_audit after insert or update or delete on prescriptions for each row execute function audit_row();

alter table prescriptions enable row level security;
create policy rx_select on prescriptions for select using (org_id = public.current_org());
create policy rx_insert on prescriptions for insert with check (org_id = public.current_org());
create policy rx_update on prescriptions for update using (org_id = public.current_org()) with check (org_id = public.current_org());

-- private bucket; files live under <org_id>/...
insert into storage.buckets (id, name, public) values ('prescriptions','prescriptions',false) on conflict do nothing;
create policy rx_files_read on storage.objects for select using (bucket_id='prescriptions' and (storage.foldername(name))[1] = public.current_org()::text);
create policy rx_files_write on storage.objects for insert with check (bucket_id='prescriptions' and (storage.foldername(name))[1] = public.current_org()::text);
