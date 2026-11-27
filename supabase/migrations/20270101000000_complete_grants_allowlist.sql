-- Phase 0 S1: complete the grants allowlist.
-- Forward hardening only; supplied for staging, never applied to live.
--
-- Supersedes the blanket grants in 20261222000000_harden_grants.sql and the
-- partial seven-name rollback in 20261230000000_settings_hardening.sql.
-- Signature-qualified on purpose: name-based loops can hit overloads or skip a
-- function that was redefined as invoker. Tenant-safe helpers and guarded Phase 2
-- RPCs keep their existing grants; everything below is service/scheduler-only.

revoke all on function public.seed_org_permissions(uuid) from public, anon, authenticated;
grant execute on function public.seed_org_permissions(uuid) to service_role;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

revoke all on function public.resolve_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.resolve_entitlements(uuid) to service_role;

revoke all on function public.org_usage(uuid) from public, anon, authenticated;
grant execute on function public.org_usage(uuid) to service_role;

revoke all on function public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)
  to service_role;

revoke all on function public.run_subscription_lifecycle() from public, anon, authenticated;
grant execute on function public.run_subscription_lifecycle() to service_role;

-- The ERP subscription print route now fetches this through the audited service
-- client after tenant RLS has already verified the invoice.
revoke all on function public.platform_billing_identity() from public, anon, authenticated;
grant execute on function public.platform_billing_identity() to service_role;

revoke all on function public.backfill_grandfather_subscriptions() from public, anon, authenticated;
grant execute on function public.backfill_grandfather_subscriptions() to service_role;

-- No-arg scheduler overload only. refresh_subscription_usage(uuid) has its own
-- own-org/platform-admin guard and intentionally remains tenant-callable.
revoke all on function public.refresh_subscription_usage() from public, anon, authenticated;
grant execute on function public.refresh_subscription_usage() to service_role;

-- Trigger/admin wrappers call these as definer; tenants must never call directly.
revoke all on function public.seed_site_pages(uuid) from public, anon, authenticated;
grant execute on function public.seed_site_pages(uuid) to service_role;

revoke all on function public.backup_tables() from public, anon, authenticated;
grant execute on function public.backup_tables() to service_role;

-- The storefront resolves tenant hosts through serviceDb(); resolve_org(text)
-- remains the anonymous path and keeps its grant.
revoke all on function public.org_for_host(text) from public, anon, authenticated;
grant execute on function public.org_for_host(text) to service_role;

revoke all on function public.entitlement_log_only(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.entitlement_log_only(uuid, text, uuid, jsonb)
  to service_role;

-- Fail the migration if the allowlist was not applied exactly.
do $$
declare
  v_sig text;
  v_oid oid;
  v_service_only text[] := array[
    'public.seed_org_permissions(uuid)',
    'public.rate_limit_hit(text, integer, integer)',
    'public.resolve_entitlements(uuid)',
    'public.org_usage(uuid)',
    'public.settle_subscription_payment(uuid, uuid, text, text, bigint, text)',
    'public.run_subscription_lifecycle()',
    'public.platform_billing_identity()',
    'public.backfill_grandfather_subscriptions()',
    'public.refresh_subscription_usage()',
    'public.seed_site_pages(uuid)',
    'public.backup_tables()',
    'public.org_for_host(text)',
    'public.entitlement_log_only(uuid, text, uuid, jsonb)'
  ];
begin
  foreach v_sig in array v_service_only loop
    select p.oid into v_oid from pg_proc p where p.oid = v_sig::regprocedure;
    if v_oid is null then
      raise exception 'Missing service-only function %', v_sig;
    end if;
    if has_function_privilege('anon', v_oid, 'execute')
       or has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception 'FAIL: % is still executable by tenant roles', v_sig;
    end if;
    if not has_function_privilege('service_role', v_oid, 'execute') then
      raise exception 'FAIL: % lost service_role EXECUTE', v_sig;
    end if;
  end loop;
end $$;
