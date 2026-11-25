-- Phase 7 — RLS policy audit: findings and fixes (plan §4 bullet 5, §10 risk 1).
-- Audit method + manual checklist: docs/SECURITY_PENTEST_CHECKLIST.md.
-- Regression proof: supabase/tests/rls_audit.sql.
--
-- Finding 1 — views bypassed RLS.
-- customer_orders, customer_loyalty_balance, itc_summary, open_po_value and
-- product_review_summary were created without security_invoker, so they ran
-- with the owner's (postgres) rights and ignored the RLS of their base
-- tables. Any authenticated tenant could read every organisation's rows
-- straight from the PostgREST endpoint. Fix: run them with the caller's
-- rights; the underlying tenant policies then scope each caller to its own
-- organisation. The service role (BYPASSRLS) still sees every row, and the
-- two public_* views are deliberately untouched — they filter on
-- request_org() by design and only expose website-public rows.
alter view public.customer_orders set (security_invoker = true);
alter view public.customer_loyalty_balance set (security_invoker = true);
alter view public.itc_summary set (security_invoker = true);
alter view public.open_po_value set (security_invoker = true);
alter view public.product_review_summary set (security_invoker = true);

-- Finding 2 — cross-org RPCs.
-- resolve_entitlements(org), org_usage(org) and seed_org_permissions(org)
-- were executable by any authenticated user (and, through the default PUBLIC
-- grant, by anon) with an arbitrary org argument: a cross-org read of
-- subscription state and headcounts, plus a cross-org permission re-seed.
-- The app only ever needs "my own organisation", so the parameter is taken
-- away entirely for tenant roles:
--   * revoke the raw functions from tenant roles (service_role, triggers,
--     definer functions and migrations keep EXECUTE — all non-tenant
--     callers),
--   * expose no-arg wrappers that resolve the caller's org server-side via
--     current_org() (profiles lookup by verified auth.uid(), so a tenant can
--     only ever resolve itself).
revoke execute on function public.resolve_entitlements(uuid) from public, anon, authenticated;
revoke execute on function public.org_usage(uuid) from public, anon, authenticated;
revoke execute on function public.seed_org_permissions(uuid) from public, anon, authenticated;
grant execute on function public.resolve_entitlements(uuid) to service_role;
grant execute on function public.org_usage(uuid) to service_role;
grant execute on function public.seed_org_permissions(uuid) to service_role;

create or replace function public.my_entitlements()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.current_org() is null then null
              else public.resolve_entitlements(public.current_org()) end;
$$;
grant execute on function public.my_entitlements() to authenticated;

create or replace function public.my_org_usage()
returns table(metric text, value bigint)
language sql stable security definer set search_path = public as $$
  select u.* from public.org_usage(public.current_org()) u;
$$;
grant execute on function public.my_org_usage() to authenticated;

-- Finding 3 — unscoped review insert.
-- product_reviews.reviews_insert had WITH CHECK (true) while every read
-- policy on the same table scopes with request_org(): an anon caller could
-- insert review rows (pending, but still writes) into any organisation if it
-- knew a product id — and product ids are public via public_catalog. Tighten
-- the insert to the same resolution the read policies use.
drop policy if exists reviews_insert on product_reviews;
create policy reviews_insert on product_reviews
  for insert to anon, authenticated
  with check (
    org_id = public.request_org()
    and customer_id is null
    and verified_purchase = false
    and status = 'pending'
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.org_id = public.request_org()
        and p.status = 'active'
        and p.visible_on_website = true
    )
  );
drop policy if exists org_anon on public.organizations;
