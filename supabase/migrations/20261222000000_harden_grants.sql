-- Production hardening: the public storefront never writes with the anon key (all anonymous writes go
-- through server routes using the service role), and mutating RPCs must not be callable anonymously.
do $$
declare t record; f record;
  anon_ok text[] := array['resolve_org','org_for_host','org_default_text','bump_product_view','public_store_name','default_org',
    'current_org','current_role_key','is_admin','is_manager','has_perm','has_permission','can_access_branch','is_prescription_expired','current_portal_customer_id'];
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t.tablename);
  end loop;
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
    if f.proname = any (anon_ok) then execute format('grant execute on function %s to anon', f.sig); end if;
  end loop;
end $$;
