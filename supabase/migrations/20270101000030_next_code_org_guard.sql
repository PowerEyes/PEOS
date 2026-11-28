-- Phase 0 hardening: direct organisation binding for next_code().
-- Forward migration only; supplied for staging, never applied to live.
--
-- effective_setting() already rejects a cross-org read, but next_code() is a
-- SECURITY DEFINER, authenticated-callable counter writer. Defence in depth
-- requires the function itself to bind p_org to the session before it touches
-- public.counters, and to reject malformed sequence keys/prefixes.

create or replace function public.next_code(p_org uuid, p_key text, p_prefix text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_org uuid := public.current_org();
  v_call_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  n int;
  v_prefixes jsonb;
  v_prefix text;
begin
  -- Authenticated callers may only advance their own org's counters. Service
  -- role (storefront) and migration/superuser sessions pass an explicit org.
  if v_session_org is not null then
    if p_org is distinct from v_session_org then
      raise exception 'Organisation mismatch for code sequence %', p_key;
    end if;
  elsif v_call_role <> 'service_role' and session_user <> 'postgres' then
    raise exception 'No organisation context for code sequence %', p_key;
  end if;

  if p_org is null then
    raise exception 'Organisation is required for code sequence %', p_key;
  end if;
  if p_key is null or p_key !~ '^[a-z0-9_.-]{1,80}$' then
    raise exception 'Invalid code sequence key';
  end if;
  if p_prefix is null or char_length(p_prefix) > 16 then
    raise exception 'Invalid code prefix';
  end if;

  v_prefixes := public.effective_setting(p_org, 'numbering.code_prefixes');

  if jsonb_typeof(v_prefixes) = 'object' then
    v_prefix := nullif(v_prefixes ->> p_key, '');
  end if;

  -- Final belt-and-braces fallback for databases where the catalog row was not
  -- seeded: the helper already handles the normal canonical/legacy mapping.
  if v_prefix is null then
    select case when jsonb_typeof(value) = 'object' then nullif(value ->> p_key, '') end
      into v_prefix
      from public.org_settings
     where org_id = p_org and key = 'code_prefixes';
  end if;

  v_prefix := coalesce(v_prefix, p_prefix);
  insert into counters(org_id, key, value) values (p_org, p_key, 1)
  on conflict (org_id, key) do update set value = counters.value + 1 returning value into n;
  return v_prefix || lpad(n::text, 4, '0');
end $$;

revoke all on function public.next_code(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.next_code(uuid, text, text) to authenticated, service_role;

comment on function public.next_code(uuid, text, text) is
  'Sequential document code generator bound to the caller organisation, using validated numbering.code_prefixes.';

-- Fail the migration if a later migration reopens or de-hardens the function.
do $$
begin
  if not (select prosecdef from pg_proc where oid = 'public.next_code(uuid, text, text)'::regprocedure) then
    raise exception 'FAIL: next_code(uuid, text, text) is not SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.next_code(uuid, text, text)'::regprocedure, 'execute') then
    raise exception 'FAIL: next_code is executable by anon';
  end if;
  if not has_function_privilege('service_role', 'public.next_code(uuid, text, text)'::regprocedure, 'execute') then
    raise exception 'FAIL: next_code lost service_role EXECUTE';
  end if;
end $$;
