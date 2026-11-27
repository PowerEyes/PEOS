-- Forward hardening for the settings control plane. Safe to re-run.
-- This does not edit migration history; it supersedes overrides introduced by
-- 20261217000030_roles_audit_consent.sql and 20261222000000_harden_grants.sql.

-- ── 1. Restore the actor on org_settings audit rows ─────────────────────────
-- The earlier replacement wrote org_id/table/action/old/new but omitted user_id,
-- so settings_change_history could show an empty actor. Keep the org_settings
-- table name explicit because this trigger is settings-specific.
create or replace function public.audit_settings_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_org uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_org := coalesce((v_new->>'org_id')::uuid, (v_old->>'org_id')::uuid);
  insert into public.audit_log (org_id, user_id, table_name, row_id, action, old_data, new_data)
  values (
    v_org,
    auth.uid(),
    'org_settings',
    nullif(coalesce(v_new->>'id', v_old->>'id'), '')::uuid,
    tg_op,
    v_old,
    v_new
  );
  return coalesce(new, old);
end $$;

drop trigger if exists trg_org_settings_audit on public.org_settings;
create trigger trg_org_settings_audit
after insert or update or delete on public.org_settings
for each row execute function public.audit_settings_row();

-- ── 2. Revoke tenant/service-only RPCs reopened by the blanket grant ────────
-- 20261222000000_harden_grants.sql granted EXECUTE on every SECURITY DEFINER
-- function to authenticated. These functions accept an org id or mutate billing
-- and must only be reachable through server code with the service role.
do $$
declare f record;
  sensitive text[] := array[
    'seed_org_permissions',
    'rate_limit_hit',
    'resolve_entitlements',
    'org_usage',
    'settle_subscription_payment',
    'run_subscription_lifecycle',
    'platform_billing_identity'
  ];
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname = any (sensitive)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

comment on function public.audit_settings_row() is
  'Settings audit writer that records auth.uid() as the actor.';
comment on function public.can_write_setting(text) is
  'Per-key write authority used by branch_settings RLS.';
