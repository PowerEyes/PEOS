-- Forward security fixes for tenant-facing public policies.
-- This migration is intentionally separate from older migrations that may
-- already be marked applied in hosted Supabase projects.

-- Site pages are public only within the storefront tenant resolved from host.
drop policy if exists sp_anon on public.site_pages;
create policy sp_anon on public.site_pages
  for select to anon, authenticated
  using (is_active and org_id = public.request_org());

-- A public review must belong to the current storefront and an active product
-- in that same organisation. Do not trust a browser-supplied customer_id or
-- verified_purchase flag; verified purchase attribution requires a separate
-- server-side order check and is deliberately disabled until then.
drop policy if exists reviews_insert on public.product_reviews;
create policy reviews_insert on public.product_reviews
  for insert to anon, authenticated
  with check (
    org_id = public.request_org()
    and customer_id is null
    and verified_purchase = false
    and status = 'pending'
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.org_id = public.request_org()
        and p.status = 'active'
        and p.visible_on_website = true
    )
  );

-- Tenant IDs and names are not a public directory. Storefront code resolves
-- the active organisation through the host-bound org_for_host RPC instead.
drop policy if exists org_anon on public.organizations;
