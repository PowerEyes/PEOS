-- Phase 1 of the settings control plane: a catalog of every known setting,
-- org/branch/user value stores, change requests, a validation helper, and
-- read-only history/public projections. This migration is behaviour-neutral:
-- existing readers (org_settings, organizations, branches, crm_settings, ...)
-- keep working exactly as before. Nothing here rewrites existing values.

-- ── 1. Catalog ────────────────────────────────────────────────────────────────
create table if not exists public.setting_definitions (
  key                  text primary key,
  legacy_key           text,
  module               text not null,
  section              text not null,
  label                text not null,
  description          text,
  scope                text not null check (scope in ('platform','org','branch','user')),
  value_type           text not null check (value_type in ('boolean','number','string','enum','json','secret')),
  default_value        jsonb not null,
  json_schema          jsonb not null default '{}'::jsonb,
  allowed_values       jsonb,
  is_public            boolean not null default false,
  is_secret            boolean not null default false,
  requires_approval    boolean not null default false,
  affects_transactions boolean not null default false,
  snapshot_policy      text not null default 'none' check (snapshot_policy in ('none','order','invoice','quote')),
  write_role           text check (write_role in ('owner','admin','manager')),
  write_permission     text,
  revalidate_paths     text[] not null default '{}',
  storage_ref          text,
  sort_order           int not null default 0,
  version              int not null default 1,
  deprecated           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint setting_definitions_public_not_secret check (not (is_public and is_secret)),
  constraint setting_definitions_legacy_key_uq unique (legacy_key)
);

create table if not exists public.branch_settings (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  key        text not null references public.setting_definitions(key) on update cascade,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, branch_id, key)
);

create table if not exists public.user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references public.organizations(id) on delete cascade,
  key     text not null references public.setting_definitions(key) on update cascade,
  value   jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, org_id, key)
);

create table if not exists public.setting_change_requests (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  key            text not null references public.setting_definitions(key) on update cascade,
  proposed_value jsonb not null,
  requested_by   uuid not null references auth.users(id),
  approved_by    uuid references auth.users(id),
  status         text not null check (status in ('pending','approved','rejected','applied')),
  reason         text,
  effective_at   timestamptz,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

-- ── 2. Seed the catalog with every setting that exists today ─────────────────
-- allowed_values is only used for enums. storage_ref points at legacy homes
-- without moving any data; the resolver can read them while Phase 2 migrates.
insert into public.setting_definitions (
  key, legacy_key, module, section, label, scope, value_type,
  default_value, allowed_values, is_public, is_secret, write_role,
  affects_transactions, snapshot_policy, requires_approval, storage_ref, sort_order
) values
  ('tax.gst_enabled', 'gst_enabled', 'tax', 'tax', 'GST enabled', 'org', 'boolean',
   'true'::jsonb, null, false, false, 'owner', true, 'order', true, null, 10),
  ('tax.gstin', 'gstin', 'tax', 'tax', 'GSTIN', 'org', 'string',
   '""'::jsonb, null, false, false, 'owner', true, 'invoice', true, null, 20),
  ('tax.default_supply_type', 'default_supply_type', 'tax', 'tax', 'Default supply type', 'org', 'enum',
   '"intrastate"'::jsonb, array['intrastate','interstate']::jsonb, false, false, 'owner', true, 'order', false, null, 30),
  ('tax.default_state_of_supply', 'default_state_of_supply', 'tax', 'tax', 'Default state of supply', 'org', 'string',
   '"Tamil Nadu"'::jsonb, null, false, false, 'owner', true, 'order', false, null, 40),
  ('tax.invoice_footer', 'invoice_footer', 'tax', 'tax', 'Invoice footer', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', true, 'invoice', false, null, 50),
  ('sales.max_discount_pct', 'max_staff_discount_pct', 'sales', 'sales', 'Maximum staff discount %', 'org', 'number',
   '10'::jsonb, null, false, false, 'owner', true, 'order', false, null, 60),
  ('sales.quote_valid_days', 'quotation_valid_days', 'sales', 'sales', 'Quotation valid days', 'org', 'number',
   '14'::jsonb, null, false, false, 'admin', true, 'quote', false, null, 70),
  ('lab.lead_days', 'lab_lead_days', 'workshop', 'sales', 'Lab lead days', 'org', 'number',
   '5'::jsonb, null, false, false, 'admin', true, 'order', false, null, 80),
  ('numbering.code_prefixes', 'code_prefixes', 'numbering', 'prefixes', 'Document code prefixes', 'org', 'json',
   '{}'::jsonb, null, false, false, 'owner', true, 'order', true, null, 90),
  ('website.whatsapp_number', 'whatsapp_number', 'website', 'website', 'Public WhatsApp number', 'org', 'string',
   '""'::jsonb, null, true, false, 'admin', false, 'none', false, null, 100),
  ('website.instagram', 'instagram', 'website', 'website', 'Instagram handle', 'org', 'string',
   '""'::jsonb, null, true, false, 'admin', false, 'none', false, null, 110),
  ('website.analytics_id', 'analytics_id', 'website', 'website', 'Analytics ID', 'org', 'string',
   '""'::jsonb, null, true, false, 'admin', false, 'none', false, null, 120),
  ('customers.default_city', 'default_city', 'customers', 'business', 'Default city', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, null, 130),
  ('customers.default_state', 'default_state', 'customers', 'business', 'Default state', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, null, 140),
  ('customers.default_pincode', 'default_pincode', 'customers', 'business', 'Default pincode', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, null, 150),
  ('system.home_state_code', 'home_state_code', 'system', 'tax', 'Home state code', 'org', 'string',
   '""'::jsonb, null, false, false, 'owner', true, 'invoice', true, null, 160),
  ('system.go_live', 'go_live', 'system', 'business', 'Go-live timestamp', 'org', 'string',
   '""'::jsonb, null, false, false, 'owner', false, 'none', true, null, 170),

  ('business.legal_name', null, 'business', 'business', 'Legal name', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, 'organizations.legal_name', 180),
  ('business.business_email', null, 'business', 'business', 'Business email', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, 'organizations.business_email', 190),
  ('business.business_phone', null, 'business', 'business', 'Business phone', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, 'organizations.business_phone', 200),
  ('business.billing_address', null, 'business', 'business', 'Billing address', 'org', 'string',
   '""'::jsonb, null, false, false, 'admin', false, 'none', false, 'organizations.billing_address', 210),
  ('business.timezone', null, 'business', 'business', 'Timezone', 'org', 'string',
   '"Asia/Kolkata"'::jsonb, null, false, false, 'admin', false, 'none', false, 'organizations.timezone', 220),
  ('business.currency', null, 'business', 'business', 'Currency', 'org', 'enum',
   '"INR"'::jsonb, array['INR']::jsonb, false, false, 'owner', true, 'invoice', true, 'organizations.currency', 230),
  ('business.financial_year_start_month', null, 'finance', 'tax', 'Financial year start month', 'org', 'number',
   '4'::jsonb, null, false, false, 'owner', true, 'invoice', true, 'organizations.financial_year_start_month', 240),

  ('branches.legal_name', null, 'branches', 'business', 'Branch legal name', 'branch', 'string',
   '""'::jsonb, null, false, false, 'manager', false, 'none', false, 'branches.legal_name', 250),
  ('branches.gstin', null, 'branches', 'tax', 'Branch GSTIN', 'branch', 'string',
   '""'::jsonb, null, false, false, 'owner', true, 'invoice', true, 'branches.gstin', 260),
  ('branches.timezone', null, 'branches', 'business', 'Branch timezone', 'branch', 'string',
   '"Asia/Kolkata"'::jsonb, null, false, false, 'manager', false, 'none', false, 'branches.timezone', 270),
  ('branches.opening_hours', null, 'branches', 'business', 'Opening hours', 'branch', 'json',
   '{}'::jsonb, null, false, false, 'manager', false, 'none', false, 'branches.opening_hours', 280),
  ('branches.invoice_terms', null, 'branches', 'tax', 'Invoice terms', 'branch', 'string',
   '""'::jsonb, null, false, false, 'admin', true, 'invoice', false, 'branches.invoice_terms', 290),
  ('branches.is_default_pickup', null, 'branches', 'business', 'Default pickup branch', 'branch', 'boolean',
   'false'::jsonb, null, false, false, 'owner', false, 'none', true, 'branches.is_default_pickup', 300),
  ('branches.is_active', null, 'branches', 'business', 'Branch active', 'branch', 'boolean',
   'true'::jsonb, null, false, false, 'owner', false, 'none', true, 'branches.is_active', 310),

  ('crm.rx_reminder_enabled', null, 'crm', 'loyalty', 'Rx reminders enabled', 'org', 'boolean',
   'false'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.rx_reminder_enabled', 320),
  ('crm.rx_reminder_days_before', null, 'crm', 'loyalty', 'Rx reminder lead days', 'org', 'number',
   '30'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.rx_reminder_days_before', 330),
  ('crm.birthday_enabled', null, 'crm', 'loyalty', 'Birthday greetings enabled', 'org', 'boolean',
   'false'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.birthday_enabled', 340),
  ('crm.birthday_coupon_pct', null, 'crm', 'loyalty', 'Birthday coupon %', 'org', 'number',
   '10'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.birthday_coupon_pct', 350),
  ('crm.order_updates_enabled', null, 'crm', 'loyalty', 'Order update messages', 'org', 'boolean',
   'true'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.order_updates_enabled', 360),
  ('crm.cart_recovery_enabled', null, 'crm', 'loyalty', 'Cart recovery enabled', 'org', 'boolean',
   'false'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.cart_recovery_enabled', 370),
  ('crm.cart_recovery_hours', null, 'crm', 'loyalty', 'Cart recovery delay hours', 'org', 'number',
   '4'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.cart_recovery_hours', 380),
  ('crm.wa_provider', null, 'crm', 'loyalty', 'WhatsApp provider', 'org', 'string',
   '"wa.me"'::jsonb, null, false, false, 'admin', false, 'none', false, 'crm_settings.wa_provider', 390),
  ('loyalty.earn_rate', null, 'loyalty', 'loyalty', 'Loyalty earn rate', 'org', 'number',
   '10'::jsonb, null, false, false, 'admin', true, 'order', false, 'loyalty_rules.earn_rate', 400),

  ('integrations.razorpay_key_id', null, 'integrations', 'integrations', 'Razorpay key ID', 'org', 'secret',
   '""'::jsonb, null, false, true, 'owner', false, 'none', true, null, 410),
  ('integrations.razorpay_key_secret', null, 'integrations', 'integrations', 'Razorpay key secret', 'org', 'secret',
   '""'::jsonb, null, false, true, 'owner', false, 'none', true, null, 420),
  ('integrations.razorpay_webhook_secret', null, 'integrations', 'integrations', 'Razorpay webhook secret', 'org', 'secret',
   '""'::jsonb, null, false, true, 'owner', false, 'none', true, null, 430),
  ('integrations.ocr_service_token', null, 'integrations', 'integrations', 'OCR service token', 'org', 'secret',
   '""'::jsonb, null, false, true, 'owner', false, 'none', true, null, 440)
on conflict (key) do update set
  legacy_key = excluded.legacy_key,
  module = excluded.module,
  section = excluded.section,
  label = excluded.label,
  scope = excluded.scope,
  value_type = excluded.value_type,
  default_value = excluded.default_value,
  allowed_values = excluded.allowed_values,
  is_public = excluded.is_public,
  is_secret = excluded.is_secret,
  write_role = excluded.write_role,
  affects_transactions = excluded.affects_transactions,
  snapshot_policy = excluded.snapshot_policy,
  requires_approval = excluded.requires_approval,
  storage_ref = excluded.storage_ref,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Module toggles are catalogued now but are not enforced in Phase 1.
insert into public.setting_definitions (
  key, module, section, label, scope, value_type, default_value,
  write_role, requires_approval, sort_order
)
select 'module.' || m.key, 'modules', 'modules', 'Enable ' || m.label, 'org', 'boolean',
       'true'::jsonb, 'owner', true, 500 + m.ord
from (
  values
    (1, 'platform'), (2, 'business'), (3, 'branches'), (4, 'tax'), (5, 'numbering'),
    (6, 'customers'), (7, 'crm'), (8, 'appointments'), (9, 'prescriptions'),
    (10, 'sales'), (11, 'inventory'), (12, 'purchases'), (13, 'workshop'),
    (14, 'repairs'), (15, 'finance'), (16, 'staff'), (17, 'payroll'),
    (18, 'website'), (19, 'storefront'), (20, 'integrations'), (21, 'system')
) as m(ord, key)
on conflict (key) do update set
  label = excluded.label,
  write_role = excluded.write_role,
  requires_approval = excluded.requires_approval,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ── 3. Validation helper (no writes are blocked by it in Phase 1) ────────────
create or replace function public.validate_setting_value(p_key text, p_value jsonb)
returns boolean language plpgsql stable set search_path = public as $$
declare
  d public.setting_definitions%rowtype;
  v_text text;
begin
  select * into d
    from public.setting_definitions
   where key = p_key or legacy_key = p_key
   limit 1;
  if not found or d.deprecated then return false; end if;

  v_text := case when jsonb_typeof(p_value) = 'string' then p_value #>> '{}' else null end;

  case d.value_type
    when 'boolean' then
      return jsonb_typeof(p_value) = 'boolean' or v_text in ('true','false');
    when 'number' then
      if jsonb_typeof(p_value) = 'number' then return true; end if;
      return coalesce(v_text ~ '^-?[0-9]+(\.[0-9]+)?$', false);
    when 'string', 'secret' then
      return jsonb_typeof(p_value) = 'string';
    when 'enum' then
      return jsonb_typeof(p_value) = 'string'
         and coalesce(d.allowed_values ? v_text, false);
    when 'json' then
      return jsonb_typeof(p_value) in ('object','array');
    else
      return false;
  end case;
end $$;

revoke all on function public.validate_setting_value(text,jsonb) from public, anon;
grant execute on function public.validate_setting_value(text,jsonb) to authenticated, service_role;

-- Single authority check for value writes. RLS still owns tenancy and branch
-- membership; this helper only resolves per-key write_role/write_permission.
-- 'manager' in the catalog corresponds to the stored role_key 'branch_manager'.
create or replace function public.can_write_setting(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  with d as (
    select * from public.setting_definitions
     where key = p_key or legacy_key = p_key
     limit 1
  ), me as (
    select public.current_role_key() as role_key
  )
  select exists (
    select 1 from d, me
     where not d.deprecated
       and (
         case d.write_role
           when 'owner' then me.role_key = 'owner'
           when 'admin' then me.role_key in ('owner','admin')
           when 'manager' then me.role_key in ('owner','admin','branch_manager')
           else false
         end
         or (d.write_permission is not null and public.has_perm(d.write_permission))
       )
  );
$$;

revoke all on function public.can_write_setting(text) from public, anon;
grant execute on function public.can_write_setting(text) to authenticated, service_role;

-- ── 4. Read-only projections ─────────────────────────────────────────────────
-- tenant-aware, public-safe, and impossible to widen by marking a secret public
-- because of the check constraint and the NOT is_secret filter.
create or replace view public.public_storefront_settings
with (security_barrier = true) as
  select s.org_id,
         coalesce(d.key, s.key) as key,
         d.module,
         s.value
    from public.org_settings s
    join public.setting_definitions d
      on d.key = s.key or d.legacy_key = s.key
   where s.org_id = public.request_org()
     and d.is_public
     and not d.is_secret
     and not d.deprecated;

create or replace view public.settings_aliases as
  select key as canonical_key, legacy_key
    from public.setting_definitions
   where legacy_key is not null;

create or replace view public.settings_change_history
with (security_invoker = true) as
  select a.id,
         a.org_id,
         a.user_id,
         coalesce(a.new_data->>'key', a.old_data->>'key') as setting_key,
         a.table_name,
         a.action,
         a.old_data,
         a.new_data,
         a.at
    from public.audit_log a
   where a.org_id = public.current_org()
     and (public.is_admin() or public.has_perm('audit.read'))
     and a.table_name in (
       'org_settings','branch_settings','user_preferences','setting_change_requests',
       'organizations','branches','message_templates','loyalty_rules','crm_settings',
       'org_domains','role_permissions','platform_settings'
     );

-- ── 5. Row level security ────────────────────────────────────────────────────
alter table public.setting_definitions enable row level security;
alter table public.branch_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.setting_change_requests enable row level security;

drop policy if exists setting_definitions_read on public.setting_definitions;
create policy setting_definitions_read on public.setting_definitions for select
using (
  auth.uid() is not null
  and exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.is_approved
       and coalesce(p.deactivated, false) = false
  )
);

drop policy if exists branch_settings_read on public.branch_settings;
create policy branch_settings_read on public.branch_settings for select
using (
  org_id = public.current_org()
  and exists (
    select 1 from public.branches b
     where b.id = branch_id and b.org_id = branch_settings.org_id
  )
);

drop policy if exists branch_settings_write on public.branch_settings;
create policy branch_settings_write on public.branch_settings
for insert to authenticated
with check (
  org_id = public.current_org()
  and exists (
    select 1 from public.branches b
     where b.id = branch_id and b.org_id = branch_settings.org_id
  )
  and public.can_write_setting(branch_settings.key)
  and exists (
    select 1 from public.setting_definitions d
     where d.key = branch_settings.key and d.scope = 'branch'
  )
);

drop policy if exists branch_settings_update on public.branch_settings;
create policy branch_settings_update on public.branch_settings for update to authenticated
using (
  org_id = public.current_org()
  and exists (
    select 1 from public.branches b
     where b.id = branch_id and b.org_id = branch_settings.org_id
  )
  and public.can_write_setting(branch_settings.key)
)
with check (
  org_id = public.current_org()
  and exists (
    select 1 from public.branches b
     where b.id = branch_id and b.org_id = branch_settings.org_id
  )
  and public.can_write_setting(branch_settings.key)
);

drop policy if exists branch_settings_delete on public.branch_settings;
create policy branch_settings_delete on public.branch_settings for delete to authenticated
using (
  org_id = public.current_org()
  and public.can_write_setting(branch_settings.key)
);

drop policy if exists user_preferences_all on public.user_preferences;
create policy user_preferences_all on public.user_preferences for all to authenticated
using (user_id = auth.uid() and org_id = public.current_org())
with check (user_id = auth.uid() and org_id = public.current_org());

drop policy if exists setting_change_requests_read on public.setting_change_requests;
create policy setting_change_requests_read on public.setting_change_requests for select to authenticated
using (org_id = public.current_org());

drop policy if exists setting_change_requests_insert on public.setting_change_requests;
create policy setting_change_requests_insert on public.setting_change_requests for insert to authenticated
with check (org_id = public.current_org() and requested_by = auth.uid());

drop policy if exists setting_change_requests_decide on public.setting_change_requests;
create policy setting_change_requests_decide on public.setting_change_requests for update to authenticated
using (org_id = public.current_org() and public.is_admin())
with check (org_id = public.current_org() and public.is_admin());

-- ── 6. Audit triggers for the new value stores ──────────────────────────────
drop trigger if exists trg_branch_settings_audit on public.branch_settings;
create trigger trg_branch_settings_audit
after insert or update or delete on public.branch_settings
for each row execute function public.audit_settings_change();

drop trigger if exists trg_user_preferences_audit on public.user_preferences;
create trigger trg_user_preferences_audit
after insert or update or delete on public.user_preferences
for each row execute function public.audit_settings_change();

drop trigger if exists trg_setting_change_requests_audit on public.setting_change_requests;
create trigger trg_setting_change_requests_audit
after insert or update or delete on public.setting_change_requests
for each row execute function public.audit_settings_change();

-- ── 7. Grants ────────────────────────────────────────────────────────────────
revoke all on public.setting_definitions from anon, authenticated;
revoke all on public.branch_settings from anon, authenticated;
revoke all on public.user_preferences from anon, authenticated;
revoke all on public.setting_change_requests from anon, authenticated;

grant select on public.setting_definitions to authenticated;
grant select, insert, update, delete on public.branch_settings to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update on public.setting_change_requests to authenticated;
grant all on public.setting_definitions to service_role;
grant all on public.branch_settings to service_role;
grant all on public.user_preferences to service_role;
grant all on public.setting_change_requests to service_role;

revoke all on public.public_storefront_settings from public;
grant select on public.public_storefront_settings to anon, authenticated;

revoke all on public.settings_aliases from public;
grant select on public.settings_aliases to authenticated;

revoke all on public.settings_change_history from public;
grant select on public.settings_change_history to authenticated;

comment on table public.setting_definitions is
  'Phase 1 settings catalog. Key metadata, defaults and authority; no runtime behaviour is changed by this table yet.';
comment on view public.public_storefront_settings is
  'Public-safe tenant projection. Secrets are excluded by definition.';
