-- 20261217000030: Role checks, audit coverage, consent and phone history.
-- Complements the earlier 0041/0042 fix sets. Safe to re-run.

-- ── 1. Shared role helper ────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid()
       and org_id = public.current_org()
       and coalesce(deactivated, false) = false
       and role_key in ('owner','admin')
  )
$$;

-- ── 2. Refunds need owner/admin (RBAC-003) ──────────────────────────────────
-- create_credit_note is security definer and previously only checked
-- current_org(), so an optometrist (or any staff) could issue a cash refund
-- and restock saleable inventory. The trigger also covers direct inserts.
create or replace function public.credit_notes_role_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an owner or admin can issue a refund or credit note.';
  end if;
  return new;
end $$;
drop trigger if exists trg_credit_notes_role_guard on credit_notes;
create trigger trg_credit_notes_role_guard
  before insert on credit_notes
  for each row execute function public.credit_notes_role_guard();

-- ── 3. Audit privileged configuration and staff changes (RBAC-008, T-03) ────
drop trigger if exists trg_profiles_audit on profiles;
create trigger trg_profiles_audit after insert or update or delete on profiles
  for each row execute function public.audit_row();

create or replace function public.audit_settings_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (org_id, table_name, row_id, action, old_data, new_data)
  values (coalesce(new.org_id, old.org_id), 'org_settings', null, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
drop trigger if exists trg_org_settings_audit on org_settings;
create trigger trg_org_settings_audit after insert or update or delete on org_settings
  for each row execute function public.audit_settings_row();

-- ── 4. Consent history (CRM-015) ────────────────────────────────────────────
create table if not exists consent_events (
  id bigserial primary key,
  org_id uuid not null default public.current_org() references organizations(id),
  customer_id uuid not null references customers(id) on delete cascade,
  channel text not null default 'whatsapp',
  opted_in boolean not null,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
alter table consent_events enable row level security;
drop policy if exists consent_events_read on consent_events;
create policy consent_events_read on consent_events for select
  using (org_id = public.current_org());
drop policy if exists consent_events_insert on consent_events;
create policy consent_events_insert on consent_events for insert
  with check (org_id = public.current_org());

-- ── 5. Mobile-number history (CRM-011) ──────────────────────────────────────
create table if not exists customer_phone_history (
  id bigserial primary key,
  org_id uuid not null default public.current_org() references organizations(id),
  customer_id uuid not null references customers(id) on delete cascade,
  old_phone text, new_phone text,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
alter table customer_phone_history enable row level security;
drop policy if exists phone_history_read on customer_phone_history;
create policy phone_history_read on customer_phone_history for select
  using (org_id = public.current_org());
drop policy if exists phone_history_insert on customer_phone_history;
create policy phone_history_insert on customer_phone_history for insert
  with check (org_id = public.current_org());
