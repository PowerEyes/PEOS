-- Cross-tenant read fixes (acceptance: "org A cannot read/write org B data").
--
-- 1. branches_active_read was created by 0020 for authenticated users with the
--    qualifier `is_active` and no organisation filter, so every signed-in user in
--    every tenant could read every other tenant's active branches. Staff already
--    have the org-scoped branch_read policy; this one now adds the same boundary
--    while keeping 0020's "active branches only" intent.
--    (20261122010000's automatic org-patching loop skipped it because it only
--    rewrites policies whose roles include anon/public.)
drop policy if exists branches_active_read on public.branches;
create policy branches_active_read on public.branches
  for select to authenticated
  using (is_active and org_id = public.current_org());

-- 2. site_pages.sp_anon was created after that same patch loop ran, so the public
--    website could render any tenant's pages. request_org() resolves the storefront
--    host for visitors and falls back to the signed-in user's own organisation.
drop policy if exists sp_anon on public.site_pages;
create policy sp_anon on public.site_pages
  for select to anon, authenticated
  using (is_active and org_id = public.request_org());
