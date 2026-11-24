-- Shim for restoring the PowerOS production schema dump into a vanilla
-- postgres:16 container (scripts/sql-upgrade-test / backup restore drill).
-- Provides the Supabase platform pieces the public schema depends on:
--   * platform roles referenced by grants and policies
--   * auth schema + auth.* helper functions used in RLS policies
--   * extensions schema used by CREATE EXTENSION ... WITH SCHEMA extensions

-- ── roles ───────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin login; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login; end if;
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
end $$;

-- ── extensions schema (dump does: CREATE EXTENSION ... WITH SCHEMA extensions) ──
create schema if not exists extensions;

-- ── auth schema + helpers referenced by RLS policies ────────────────────────
create schema if not exists auth;

-- minimal auth.users: the public schema has foreign keys to it
-- (customers.auth_user_id, profiles.id, platform_admins.user_id, ...)
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  ), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')
  )
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.email', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'email'
  ), '')
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to public;
grant execute on function auth.role() to public;
grant execute on function auth.email() to public;
grant execute on function auth.jwt() to public;
