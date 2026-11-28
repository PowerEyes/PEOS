-- Follow-up to 20261227000000: to_regclass() looks up relations, not functions,
-- so the restore action and backfill were skipped even though seed_site_pages
-- exists. Use to_regprocedure() and re-run the idempotent seed for every org.

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

do $$
declare o record;
begin
  if to_regprocedure('public.seed_site_pages(uuid)') is not null then
    for o in select id from organizations loop
      perform public.seed_site_pages(o.id);
    end loop;
  end if;
end $$;
