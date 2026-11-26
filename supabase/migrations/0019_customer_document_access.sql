-- ── Customer-readable document rows for the portal ────────────────────────────
-- Powers /my/documents and repairs the data visibility of the existing portal
-- pages (/my/orders, /my/payments, /my/prescriptions, /my/repairs …).
--
-- Why this is needed: every base SELECT policy on sales / sale_lines /
-- payments / prescriptions / repairs / appointments is
-- `org_id = public.current_org()`, and current_org() resolves via
-- `profiles … is_approved` — which is NULL for website customers (they have no
-- approved staff profile; see 0018). A NULL comparison silently returns zero
-- rows in PostgREST, so the portal queries succeed but always come back empty.
--
-- These policies grant SELECT on a customer's OWN rows only (keyed on
-- auth.uid() → customers.auth_user_id), and each one is created only when a
-- policy of the same name does not already exist — so this file is safe to run
-- on databases that were patched manually (it will simply no-op).

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sales_customer_select') then
    create policy sales_customer_select on public.sales
      for select to authenticated
      using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sale_lines_customer_select') then
    create policy sale_lines_customer_select on public.sale_lines
      for select to authenticated
      using (sale_id in (select id from public.sales
                         where customer_id in (select id from public.customers where auth_user_id = auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'payments_customer_select') then
    create policy payments_customer_select on public.payments
      for select to authenticated
      using (sale_id in (select id from public.sales
                         where customer_id in (select id from public.customers where auth_user_id = auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'prescriptions_customer_select') then
    create policy prescriptions_customer_select on public.prescriptions
      for select to authenticated
      using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'repairs_customer_select') then
    create policy repairs_customer_select on public.repairs
      for select to authenticated
      using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'appointments_customer_select') then
    create policy appointments_customer_select on public.appointments
      for select to authenticated
      using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
  end if;
end $$;

-- ── Prescription scans (private `prescriptions` bucket) ───────────────────────
-- Files are stored at <org_id>/<uuid>.jpg (see apps/erp/src/app/(app)/
-- prescriptions/view.tsx). The existing rx_files_read policy is org-scoped via
-- current_org(), which is NULL for customers — so let a customer read exactly
-- the objects attached to their own prescriptions (enables "View scan" on
-- /my/documents, which signs a short-lived URL server-side).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'rx_files_customer_read') then
    create policy rx_files_customer_read on storage.objects
      for select to authenticated
      using (bucket_id = 'prescriptions'
        and exists (select 1 from public.prescriptions p
                    where p.image_path = name
                      and p.customer_id in (select id from public.customers where auth_user_id = auth.uid())));
  end if;
end $$;
