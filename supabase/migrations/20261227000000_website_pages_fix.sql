-- Website page 404 fix.
--
-- Two independent problems made /about (and every other CMS-backed storefront
-- route) render the 404 component even when the row existed:
--   1. getOrgId() only checked org_domains + DEFAULT_ORG_ID, so an unmapped host
--      produced no org and the page read silently returned null.
--   2. request_org() only read the x-site-host header, which the storefront
--      never sent, so RLS could resolve a different org than the app did.
--
-- This migration aligns RLS with the host actually being browsed and adds a
-- safe, admin-only restore path for built-in pages. Existing rows are never
-- overwritten: seed_site_pages() inserts missing rows with ON CONFLICT DO NOTHING.

create or replace function public.request_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with hdr as (
    select coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-site-host',
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-host',
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'host'
    ) as host
  )
  select coalesce(
    public.current_org(),
    (select public.resolve_org(host) from hdr),
    public.default_org()
  );
$$;
revoke execute on function public.request_org() from public;
grant execute on function public.request_org() to anon, authenticated, service_role;

-- Admin-only restore. Calls the existing seed (missing rows only), so a page an
-- operator intentionally hid is left hidden and no edited content is replaced.
create or replace function public.admin_restore_site_pages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org();
  v_before integer;
  v_after integer;
begin
  if v_org is null then
    raise exception 'No organisation is selected for this account.';
  end if;
  if not public.is_admin() then
    raise exception 'Only administrators can restore website pages.';
  end if;
  if to_regprocedure('public.seed_site_pages(uuid)') is null then
    raise exception 'The site_pages seed function is missing; apply 20261219000000_site_pages_defaults.sql first.';
  end if;
  select count(*) into v_before from public.site_pages where org_id = v_org;
  perform public.seed_site_pages(v_org);
  select count(*) into v_after from public.site_pages where org_id = v_org;
  return v_after - v_before;
end $$;
revoke execute on function public.admin_restore_site_pages() from public, anon;
grant execute on function public.admin_restore_site_pages() to authenticated;

-- Repair every existing tenant (including organisations created before the
-- seed trigger existed). Idempotent and additive only.
do $$
declare o record;
begin
  if to_regprocedure('public.seed_site_pages(uuid)') is not null then
    for o in select id from organizations loop
      perform public.seed_site_pages(o.id);
    end loop;
  end if;
end $$;
