-- ── 0020: Display & shelf management + repair photos & consent ────────────────
--
-- Part 1 — products gain display / shelf placement columns (managed from the
--         ERP product drawer's new "Display" tab and the top-level
--         "Display & Shelf" inventory tab).
-- Part 2 — repairs gain intake photos (<=3, customer or staff), staff
--         after-repair photos (<=3), and a recorded customer consent for
--         registering WITHOUT any photo.
-- Part 3 — private `repair-images` bucket at <org_id>/<customer_id>/<uuid>.jpg
--         so BOTH staff (org folder) and the owning customer (own folder)
--         can read the same objects.
-- Part 4 — RLS: customer INSERT on repairs (own customer, own org, forced
--         pending/unpaid) and authenticated read of active branches (the
--         portal register form needs a branch list; branches_anon only
--         covers the anon role, so /my/repairs.branches(name) is null today).

-- ── Part 1: products display & shelf ──────────────────────────────────────────
alter table products
  add column if not exists on_display boolean not null default true,
  add column if not exists display_section text not null default 'shelf',
  add column if not exists shelf_location text,
  add column if not exists display_order int not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.products'::regclass
                   and conname = 'products_display_section_check') then
    alter table public.products add constraint products_display_section_check
      check (display_section in ('window','counter','wall','shelf','back_store'));
  end if;
end $$;

-- ── Part 2: repairs photos + consent ──────────────────────────────────────────
alter table repairs
  add column if not exists images text[] not null default '{}',
  add column if not exists after_images text[] not null default '{}',
  add column if not exists photo_consent boolean not null default false,
  add column if not exists photo_consent_at timestamptz;

-- ── Part 3: repair-images bucket + object policies ────────────────────────────
insert into storage.buckets (id, name, public)
  values ('repair-images', 'repair-images', false)
  on conflict do nothing;

do $$
begin
  -- Staff: any object under their own org folder (read + write).
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'repair_files_staff_read') then
    create policy repair_files_staff_read on storage.objects
      for select to authenticated
      using (bucket_id = 'repair-images'
        and (storage.foldername(name))[1] = public.current_org()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'repair_files_staff_write') then
    create policy repair_files_staff_write on storage.objects
      for insert to authenticated
      with check (bucket_id = 'repair-images'
        and (storage.foldername(name))[1] = public.current_org()::text);
  end if;

  -- Customer: only objects under <their org>/< their customer id >/…
  -- (covers both their own uploads and staff uploads placed in their folder).
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'repair_files_customer_read') then
    create policy repair_files_customer_read on storage.objects
      for select to authenticated
      using (bucket_id = 'repair-images'
        and exists (select 1 from public.customers c
                    where c.auth_user_id = auth.uid()
                      and (storage.foldername(name))[1] = c.org_id::text
                      and (storage.foldername(name))[2] = c.id::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'repair_files_customer_write') then
    create policy repair_files_customer_write on storage.objects
      for insert to authenticated
      with check (bucket_id = 'repair-images'
        and exists (select 1 from public.customers c
                    where c.auth_user_id = auth.uid()
                      and (storage.foldername(name))[1] = c.org_id::text
                      and (storage.foldername(name))[2] = c.id::text));
  end if;
end $$;

-- ── Part 4: portal RLS ────────────────────────────────────────────────────────
-- Customers can register a repair themselves. Tightened so they cannot forge
-- status/payment/ownership: pending + unpaid + own customer + own org; the
-- repairs_before trigger recomputes total_amount regardless of any input.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'repairs_customer_insert') then
    create policy repairs_customer_insert on public.repairs
      for insert to authenticated
      with check (
        status = 'pending'
        and paid = false
        and sale_id is null
        and (customer_id, org_id) in
            (select id, org_id from public.customers where auth_user_id = auth.uid()));
  end if;

  -- Branch picker for the register form (and fixes branches(name) on
  -- /my/repairs, which is null today because branches_anon targets only anon).
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'branches_active_read') then
    create policy branches_active_read on public.branches
      for select to authenticated using (is_active);
  end if;
end $$;
