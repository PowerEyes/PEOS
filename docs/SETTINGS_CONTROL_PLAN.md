# PowerOS — End-to-End Settings Control Plane Plan

**Date:** 2026-11-26  
**Scope:** ERP (`apps/erp`), storefront (`apps/web`), Supabase schema/RPC/RLS, shared packages, edge functions and operational configuration.  
**Method:** read-only source/schema/documentation audit. No database records were changed and no migrations were applied in this pass.  
**Goal:** one authoritative, typed, audited settings system that controls every ERP module and every storefront behaviour from the owner/admin surface.

---

## 1. Executive answer

PowerOS already has the *bones* of a settings system, but not a control plane:

- `org_settings` (`org_id`, `key`, `value jsonb`) is the closest thing to a central store.
- `/settings` already has a 10-section admin UI and audit history.
- `public_site_settings` already proves the safe pattern for exposing public settings to the website.
- `role_permissions`, `permission_catalog`, `crm_settings`, `message_templates`, `loyalty_rules`, `website_sections/content`, `site_pages`, `branches`, `platform_settings` and `billing_plans.features` all hold configuration.

The problem is that control is **fragmented**: the same concept is edited in different places, read by hand-written coercion in `apps/erp/src/lib/settings.ts`, duplicated as hardcoded constants in the storefront, and only sometimes enforced in the database. Some settings appear in the UI but do nothing (branding colours, hours, security stubs); some behaviour-changing values are not settings at all (delivery fee, currency, payment methods, Rx expiry, GST supply defaults in `place_sale`).

**Build a settings control plane with four layers:**

1. **DB catalog + values** — one registry of every setting (type, scope, default, validation, public/secret flag, who may change it), with values stored in `org_settings`, `branch_settings`, `user_preferences` and `platform_settings`.
2. **Shared contract package** — `packages/settings` with canonical keys, defaults, Zod schemas, module registry and a server-only resolver. Pure domain math stays in `packages/business-rules`.
3. **Four enforcement gates** — database (RLS/RPC/triggers), server actions/API, route middleware, and UI/navigation. A module or setting is not “controlled” unless all four agree.
4. **Change management** — validation, impact preview, owner-only keys, approval for critical changes, audit, cache invalidation, revalidation and rollback.

Do **not** start this build until the Phase 0 stabilization items in §9 are fixed. A control plane built on drifted grants and a broken `place_sale` would only spread the defects faster.

---

## 2. Current-state findings (what we are replacing)

### 2.1 What already works and should be kept

| Existing asset | Location | Keep/upgrade |
|---|---|---|
| `org_settings` KV JSONB table | `0004_sales.sql` | Keep as the canonical org value store; add a registry and namespaced keys. |
| Admin-only writes on `org_settings` | `0004_sales.sql:6-8` | Keep, but make permission per-key via `setting_definitions.write_role/write_permission`. |
| Settings audit trigger | `20261129000000_settings_configuration.sql:95-127` | Keep; add a normalized `settings_change_history` view for the UI. |
| Tenant-aware public view | `public_site_settings` in `20261122010000_org_driven_permissions.sql:157-160` | Extend into `public_storefront_settings` with an explicit allowlist. |
| `current_org()`, `request_org()`, `resolve_org(host)`, `default_org()` | active migrations | Keep as the identity root. All settings reads must derive org from these, never client input. |
| `role_permissions` + `has_permission()` | `20261128000000_data_driven_workflows.sql`, `20261212000000_role_model_expansion.sql` | Keep as the RBAC source; add setting-write permissions to it. |
| 10-section `/settings` UI and primitives | `settings/view.tsx`, `settings/ui.tsx`, `SettingsDrawer.tsx` | Keep the shell; drive it from the catalog instead of a hardcoded `AppSettings` type. |
| Website Studio / CMS | `(app)/website`, `website_sections`, `website_content`, `site_pages` | Keep as the complex-content editor; expose its outputs through the new resolver. |
| React `cache()` + providers on web | `apps/web/src/lib/site.ts`, `chrome.tsx`, `site-context.tsx` | Evolve into one `StorefrontConfigProvider`. |

### 2.2 Fragmentation to consolidate

| Concept | Current homes | Problem |
|---|---|---|
| GST / invoice | `org_settings.gst_enabled`, `gstin`, `default_supply_type`, `default_state_of_supply`; `organizations`; branch `gstin`; `packages/business-rules/gst.ts`; POS `tax_pct: 18` | Tax behaviour is only partly settings-driven; `place_sale` still hardcodes intrastate/Tamil Nadu and reads `current_org()` in storefront context. |
| Number prefixes | `org_settings.code_prefixes` via `next_code()` | Works, but no validation/versioning; changing prefixes mid-flight needs a policy. |
| Business/branch | wide columns on `organizations` and `branches` | Not registered, typed or governed like other settings. |
| CRM automation | `crm_settings` table + edge functions | Separate surface and separate defaults from `/settings`. |
| Loyalty | `loyalty_rules` in both Settings and `/loyalty` | Two editors, duplicated fallback `earn_rate = 10`. |
| Website/contact | `org_settings`, `public_site_settings`, `website_sections/content`, `site_pages`, branches | Nine independent sources; no single `getStorefrontConfig()`. |
| Checkout commerce | hardcoded delivery fee `99`, `INR`, states, payment methods, trust copy, tracking steps in `apps/web` | Owner cannot control frontend commerce policy. |
| Branding/hours/security | stub sections with local `useState` and hardcoded colours/hours | UI looks configurable but saves nothing. |
| Integrations | env vars in both apps, `integration_secrets`, `/settings/integrations` env-status page | No per-org Razorpay account, no secret-aware UI, no safe “configured/not configured” projection. |
| Feature flags | GST flag, CRM toggles, `website_sections.enabled`, `site_pages.is_active`, `plan features`, `entitlement_enforcement`, branch `is_active`, demo cookie bypass | Heterogeneous; no module on/off registry or consistent fail-closed behaviour. |

---

## 3. Target architecture

```text
                 ┌──────────────────────────────────────────────────────────┐
                 │ ERP Settings UI (catalog-driven, section rail)           │
                 │ /settings · /settings/modules · /settings/storefront     │
                 │ /settings/security · /settings/integrations              │
                 └──────────────────────┬───────────────────────────────────┘
                                        │ server actions + RPCs
                 ┌──────────────────────▼───────────────────────────────────┐
                 │ @poweros/settings (shared contract)                      │
                 │ keys · defaults · schemas · module registry · resolver   │
                 └───┬──────────────┬──────────────────┬────────────────────┘
                     │              │                  │
        ┌────────────▼──┐  ┌────────▼────────┐  ┌─────▼────────────────┐
        │ DB catalog    │  │ Enforcement     │  │ Public projection     │
        │ setting_      │  │ RLS / RPC /     │  │ public_storefront_    │
        │ definitions   │  │ triggers /      │  │ settings (allowlist)  │
        │ org_settings  │  │ server actions  │  │ + revalidate tag      │
        │ branch/user   │  │ middleware / UI │  │                       │
        └───────────────┘  └─────────────────┘  └──────────────────────┘
                     │              │                  │
                 ┌───▼──────────────▼──────────────────▼────────────────────┐
                 │ ERP modules + storefront pages/API + edge functions      │
                 └──────────────────────────────────────────────────────────┘
```

### 3.1 Resolution order

For every effective value:

```text
platform default (code) 
  → platform_settings (platform admin only)
  → setting_definitions.default_value
  → org_settings value
  → branch_settings override (if setting is branch-scoped)
  → user_preferences (UI preferences only, never money/clinical rules)
```

Org and branch are always derived from `auth.uid()` / `current_org()` for ERP and from `request_org()` / `org_for_host()` for storefront. A client-sent `org_id` or `branch_id` is ignored.

### 3.2 Setting kinds

| Kind | Examples | Storage |
|---|---|---|
| Scalar business rule | `tax.gst_enabled`, `sales.max_discount_pct`, `sales.quote_valid_days` | `org_settings` |
| Structured object | `tax.code_prefixes`, `checkout.payment_methods`, `lens.usage_options` | `org_settings` JSONB, schema-validated |
| Wide-column config | `organizations.legal_name`, `branches.opening_hours` | Keep columns; register them in `setting_definitions.storage = 'organizations.legal_name'` and read via adapter |
| Dedicated entity | message templates, loyalty rules, CMS sections, role permissions, plans | Keep tables; expose through catalog links and typed editors |
| Secret | Razorpay key/secret/webhook secret, OCR token, preview key, reset secret | `integration_secrets` or deployment secret manager; catalog marks `is_secret`, UI shows only “configured” |
| Platform | entitlement mode, SaaS GSTIN/rate, demo/signup availability | `platform_settings`, platform guard only |
| User preference | sidebar collapsed, table page size, locale display | `user_preferences` or existing client storage; never affects business outcomes |

---

## 4. New data model and shared package

### 4.1 Migration: `20261229000000_settings_control_plane.sql`

Apply after the current active stream ending `20261228000000_website_restore_fix.sql`.

```sql
create table if not exists public.setting_definitions (
  key                  text primary key,                 -- 'tax.gst_enabled'
  legacy_key           text,                             -- 'gst_enabled'
  module               text not null,                    -- 'finance', 'website', ...
  section              text not null,                    -- 'tax', 'storefront', ...
  label                text not null,
  description          text,
  scope                text not null check (scope in ('platform','org','branch','user')),
  value_type           text not null check (value_type in ('boolean','number','string','enum','json','secret')),
  default_value        jsonb not null,
  json_schema          jsonb not null,                   -- JSON Schema used by UI + server validation
  allowed_values       jsonb,                            -- enum options
  is_public            boolean not null default false,   -- safe for storefront projection
  is_secret            boolean not null default false,   -- never returned in public/config payloads
  requires_approval    boolean not null default false,
  affects_transactions boolean not null default false,   -- needs effective_at/snapshot policy
  snapshot_policy      text not null default 'none' check (snapshot_policy in ('none','order','invoice','quote')),
  write_role           text check (write_role in ('owner','admin','manager')), -- 'manager' maps to role_key 'branch_manager'
  write_permission     text,                             -- optional extra role_permissions grant
  revalidate_paths     text[] not null default '{}',
  storage_ref          text,                             -- 'org_settings', 'organizations.legal_name', ...
  sort_order           int not null default 0,
  version              int not null default 1,
  deprecated           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.branch_settings (
  org_id     uuid not null references organizations(id) on delete cascade,
  branch_id  uuid not null references branches(id) on delete cascade,
  key        text not null references setting_definitions(key),
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, branch_id, key)
);

create table if not exists public.user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references organizations(id) on delete cascade,
  key     text not null references setting_definitions(key),
  value   jsonb not null,
  primary key (user_id, org_id, key)
);

create table if not exists public.setting_change_requests (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  key            text not null references setting_definitions(key),
  proposed_value jsonb not null,
  requested_by   uuid not null,
  approved_by    uuid,
  status         text not null check (status in ('pending','approved','rejected','applied')),
  reason         text,
  effective_at   timestamptz,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

create or replace view public.settings_change_history as
select a.org_id, a.created_at, a.user_id, a.table_name, a.action,
       a.old_data, a.new_data
from public.audit_log a
where a.table_name in ('org_settings','branch_settings','user_preferences',
                       'organizations','branches','message_templates',
                       'loyalty_rules','crm_settings','org_domains',
                       'role_permissions','platform_settings');
```

RLS:

- `setting_definitions`: readable by any approved staff; writes only service role/platform admin.
- `branch_settings`: same org + `can_access_branch()` for reads; writes require `is_admin()` or `write_permission`.
- `user_preferences`: `user_id = auth.uid()` only.
- `setting_change_requests`: requester/approver can read own org; owner/admin can approve.
- `settings_change_history`: read-only, owner/admin (or per `audit_read` policy).
- Add a DELETE policy to `org_settings` only for deprecated keys, or keep upsert-only and mark deprecated.

Backfill:

- Insert one `setting_definitions` row for every existing key: `gst_enabled`, `gstin`, `state`, `state_code`, `lab_lead_days`, `max_staff_discount_pct`, `quotation_valid_days`, `code_prefixes`, `default_city/state/pincode`, `default_supply_type`, `default_state_of_supply`, `whatsapp_number`, `instagram`, `analytics_id`, `go_live`, `home_state_code` (seed if missing).
- Map wide columns (`organizations.*`, `branches.*`), `crm_settings.*`, `loyalty_rules.*`, `website_sections.enabled` and `site_pages.is_active` via `storage_ref`.
- Keep legacy `org_settings` keys readable for one release; update readers to the resolver, then retire the aliases.

### 4.2 New package: `packages/settings`

Add `@poweros/settings` to both apps via `workspace:*` and `transpilePackages`.

```text
packages/settings/src/
  index.ts          public exports for apps
  keys.ts           canonical SettingKey union + legacy key map
  defaults.ts       pure default values (no Supabase imports)
  schemas.ts        Zod + JSON Schema for every key
  modules.ts        MODULES registry, route prefixes, dependencies, disableMode
  types.ts          SettingDefinition, SettingScope, ResolvedSettings, ModuleDefinition
  server.ts         server-only getEffectiveSetting(), resolveSettings(), guards
  public.ts         public projection types for storefront
  errors.ts         setting/module denied errors using existing dbError style
```

Rules:

- `defaults.ts`, `schemas.ts`, `modules.ts`, `types.ts` must stay pure so ERP, web, edge functions and tests can import them.
- `server.ts` is server-only; it may use Supabase admin/service clients but must never serialize `is_secret` values to the client.
- `packages/business-rules` remains pure domain math (Rx, GST calculation, inventory CTA). It imports nothing from settings; settings feeds its parameters.

### 4.3 Core resolver API

```ts
getEffectiveSetting(key: SettingKey, ctx: { orgId?: string; branchId?: string; userId?: string }): SettingValue
resolveSettings(namespace: SettingNamespace, ctx): ResolvedSettings
assertModuleEnabled(module: ModuleKey, orgId: string): void
assertSettingPermission(key: SettingKey, action: 'read'|'write'): void
getPublicStorefrontConfig(host?: string): StorefrontConfig
```

All functions fail closed: unknown key, malformed value, missing org or inactive module throws/denies rather than silently falling back to an insecure default.

---

## 5. Authority model

Resolved: `setting_definitions.write_role` + optional `write_permission` are
the single authority. `SETUP.md`, `GO_LIVE_CHECKLIST.md`, `WEBSITE_SETUP.md`
and `docs/API.md` now match the implementation: owner/admin may write settings
unless a key is marked `write_role = 'owner'`. The catalog value `manager`
means the stored role `branch_manager`; there is no literal `manager` role.

| Role | Allowed settings |
|---|---|
| Platform admin | `platform_settings`, plans, entitlement mode, SaaS billing identity, domain verification, demo/signup availability. Never tenant-private data without break-glass. |
| Tenant owner | Tax/GSTIN, code prefixes, module enable/disable, payment accounts, critical security, branch lifecycle, user-management policy, approval of critical changes. |
| Tenant admin | Operational settings: CMS, templates, loyalty, CRM, hours, coupons, integrations status. Cannot change owner-only keys unless explicitly granted. |
| Branch manager | Branch-scoped overrides only where `scope = 'branch'` and `write_role <= manager`; no org tax/security/module changes. |
| Specialist staff | No settings writes; may receive `write_permission` grants for narrow operational keys (e.g. `catalogue_edit` for display flags). |
| Customer | No settings access. Only public projection and own user preferences. |

`setting_definitions.write_role` + optional `write_permission` are checked in server actions and again in DB RLS/RPCs. Client-side `canEdit` becomes a display hint only.

---

## 6. Module-by-module control matrix

Every row must end up with: catalog keys → resolver → enforcement in DB + server + middleware + UI → audit → test.

| # | Module | Settings to centralize | Scope | Primary enforcement |
|---|---|---|---|---|
| 1 | Platform & tenancy | `entitlement_enforcement`, SaaS GSTIN/rate, demo/signup enabled, plan features, domain verification, default org | platform | platform guard, web signup/demo routes, subscription RPCs |
| 2 | Business & branches | legal name, business email/phone, billing address, timezone, currency (INR locked), FY start, branch code/name/address/GSTIN/hours/invoice terms/default pickup/active | org, branch | `organizations`/`branches` columns, `set_branch_active`, `set_default_pickup_branch`, store locator |
| 3 | Tax & invoicing | `tax.gst_enabled`, `tax.gstin`, `tax.default_supply_type`, `tax.default_state_of_supply`, HSN map, invoice footer, GSTR cutoff/state code, snapshot policy | org, branch | `place_sale`, invoice/receipt print, GST ledger, GSTR-1; historical lines keep snapshots |
| 4 | Numbering | `code.code_prefixes` per entity, reset policy, sequence year/month | org | `next_code()`, sale triggers; only new records use new prefixes |
| 5 | Customers & CRM | duplicate-phone policy, consent required, default city/state/pincode, Rx reminder days, birthday toggle/coupon %, order updates, cart recovery hours, WhatsApp provider, opt-out defaults | org | customer actions, `crm_settings`, edge functions, RLS |
| 6 | Prescriptions & exams | require approval, approval roles, reapproval on edit, expiry days, VA required, cyl/axis and PD ranges, OCR enabled, Rx print header | org, branch | `packages/business-rules/rx.ts`, exam actions, DB triggers, print Rx |
| 7 | Appointments | slot duration, buffer, working hours, max per slot, doctor/optometrist assignment, booking mode (`whatsapp`/`database`/`hybrid`), reminders | branch | booking RPC, web `/eye-test`, CRM reminder jobs |
| 8 | POS, quotations & orders | max staff discount, discount override permission, quote validity, payment methods, idempotency window, stock deduction/negative stock, receipt format, supply type toggle | org, branch | `place_sale`, POS UI, print routes, RBAC `discount_override` |
| 9 | Inventory | low-stock threshold, barcode required/unique, SKU prefix, cost visibility, display sections, website visibility defaults, stock-audit frequency | org, branch | inventory actions, RLS, `public_catalog`, stock triggers |
| 10 | Lens catalogue | eligibility rules, add-on defaults, usage options, step labels, lead times, supplier/tier, recommendation engine, storefront configurator enabled | org | `ctaFor`, LensConfigurator, `public_catalog`, lab job creation |
| 11 | Lab & workshop | workflow stages, auto-create from sale, SLA/priority, due-date formula, technician assignment, buying-list threshold | org, branch | `place_sale` lab jobs, workshop actions, print lab card |
| 12 | Repairs & warranty | status flow, warranty days, photo requirement, WhatsApp templates, pickup/delivery rules | org | repairs actions, templates, customer portal |
| 13 | Purchases & suppliers | PO prefix, approval limit, GRN required, payment terms, supplier fields | org, branch | purchase actions, `purchases_manage`, RLS |
| 14 | Finance & GST | FY start, GST periods, credit-note approval, day-closing rules, accountant export fields, GSTR mapping, closed-period lock | org | finance actions/RPCs, restrictive RLS, audit |
| 15 | Staff & RBAC | role permissions, branch access, invitation expiry, deactivation, last-owner protection, audit | org | `role_permissions`, `has_permission`, `admin_update_staff`, middleware |
| 16 | Payroll & HR | salary structures, leave types, holidays, payslip override policy, payroll approval | org | payroll actions/RPCs, manager/admin gates |
| 17 | Website/CMS | site name, logo, brand colours, theme, SEO title/description/site URL, nav/footer, homepage sections, pages, policies, review moderation, coupons | org, public subset | `public_storefront_settings`, CMS tables, ERP Website Studio, web providers |
| 18 | Storefront commerce | currency, delivery fee, free-shipping threshold, allowed states, tracking steps, payment methods, COD/online flags, Razorpay display name/theme/description, trust copy, referral points/discount, exit popup | org, public subset | checkout/order APIs recalculate server-side; web UI consumes resolver |
| 19 | Integrations | Razorpay per-org keys/webhook, OCR endpoint/token, WhatsApp provider/tokens, Google Drive backup, SMTP, rate limits, health tokens | org + secret/platform | `integration_secrets`, env/secret manager, health route, webhooks |
| 20 | System & reliability | maintenance mode, backup schedule/retention/folder, doc-link TTL/maxViews, audit retention, log level, offline POS mode | org, platform | middleware, cron, backup lib, doc links, API health |

### 6.1 Module on/off registry

`MODULES` in `packages/settings/src/modules.ts` is the single source for:

- sidebar items, submenu items and quick actions;
- `routeAllowed()` in `apps/erp/src/lib/rbac.ts`;
- middleware redirects;
- command palette entries;
- server-action guards via `withModuleGuard()`;
- DB RPC guards via `assert_module_enabled()` for high-risk modules (POS, finance, payroll, website orders);
- storefront nav and route gating for customer-facing modules.

`disableMode` per module:

| Mode | Meaning | Example |
|---|---|---|
| `hide` | Remove nav/routes; direct URL denied; existing data readable in reports | CRM, loyalty |
| `read_only` | Existing data viewable, all writes blocked | payroll, repairs after closure |
| `block` | Hard stop with maintenance message; used only with open-order checks | POS during migration, website checkout |

A toggle must never leave in-flight work broken. Before disabling POS/finance/lab, the UI shows an impact count (open orders, unpaid payments, active lab jobs) and requires owner confirmation.

---

## 7. Storefront control plane

### 7.1 Public projection

Replace/augment `public_site_settings` with:

```sql
create or replace view public.public_storefront_settings as
select s.org_id, d.module, d.key, s.value
from public.org_settings s
join public.setting_definitions d
  on d.legacy_key = s.key or d.key = s.key
where s.org_id = public.request_org()
  and d.is_public
  and not d.is_secret
  and not d.deprecated;
```

Grant `select` to `anon, authenticated`. Never include `integration_secrets`, Razorpay secrets, OCR tokens, preview keys or reset secrets. Keep `public_site_settings` as a compatibility view during rollout.

### 7.2 Single web resolver

Create `apps/web/src/lib/storefront-config.ts`:

```ts
getStorefrontConfig(host?: string): Promise<StorefrontConfig>
```

It merges, in order:

1. pure defaults from `@poweros/settings/defaults`;
2. `public_storefront_settings`;
3. `getSiteChrome()` CMS output;
4. branch-derived phones/hours/map embeds;
5. `getStoreName()`;
6. preview overlay only when `?preview=1&k=<SITE_PREVIEW_KEY>` is valid.

Then evolve providers:

- `SiteProvider` → `StorefrontConfigProvider`;
- `ChromeProvider` stays or is absorbed;
- add typed hooks `useBranding()`, `useCommerceSettings()`, `useCheckoutSettings()`, `useTrustCopy()`, `useGrowthSettings()`;
- keep secret-dependent behaviour server-only.

### 7.3 Storefront values to move into settings

Hardcoded values to replace (exact locations were confirmed in the storefront audit):

- delivery fee `₹99` and free-shipping copy (`checkout/route.ts`, `checkout/page.tsx`, `product/[id]/page.tsx`);
- `INR` currency in checkout and order confirm;
- Indian state list and allowed states;
- payment method list and online/COD flags;
- Razorpay display name, description, theme colour;
- 4-step success tracker and 7-step tracking statuses;
- trust/security/warranty/exchange copy;
- branding theme colour, logo, SEO description/locale/site URL, robots/sitemap domain;
- lens usage options, steps and package chips;
- referral points/discount, exit-popup delay/quiet paths/trust strip;
- review minimum length, moderation copy, auto-approve policy;
- eye-test booking mode and Rx upload mode (currently WhatsApp-only, not persisted to ERP).

### 7.4 Revalidation

- Add/harden `POST /api/revalidate` with shared-secret verification and org-scoped tags.
- On any setting write, emit `revalidateTag('settings:' + orgId)` and `revalidateTag('storefront:' + orgId)`; invalidate the web host cache (`tenant.ts` 60s cache) on domain changes.
- Keep CMS reads `no-store` where preview immediacy matters.
- Never log full preview URLs containing `k`.

---

## 8. Change management and safety rules

### 8.1 Per-setting definition of done

A setting is not finished until all of these are true:

1. Registered in `setting_definitions` with key, legacy key, module/section, type, default, JSON Schema, scope, public/secret flags, write authority and version.
2. Read through `@poweros/settings`; no feature directly reads `org_settings` by string key.
3. Validated on write in server action **and** DB.
4. Enforced in all four gates: DB, server action/API, middleware/route, UI/navigation.
5. Public values exposed only through the allowlisted projection.
6. Audit row written with old/new values, actor and reason.
7. Cache/revalidation tag fired.
8. Transaction-affecting settings have `effective_at` and snapshot policy; historical invoices/orders are immutable.
9. Both on and off states are tested in ERP and storefront.
10. Documented in this plan and in the setup/go-live checklist.

### 8.2 Effective dating and snapshots

| Setting | Rule |
|---|---|
| GST rate/GSTIN/supply type | New transactions only; `sale_lines` and invoices keep tax snapshot. |
| Code prefixes | New records only; never rewrite existing numbers. |
| Discount cap | Evaluated at sale creation; recorded on the sale for audit. |
| Delivery fee / free-shipping threshold | Server recalculates at checkout creation; quote stores the applied value. |
| Loyalty/referral rewards | Ledger records the rule version used. |
| Rx expiry/approval | Existing Rx keeps its original status until explicitly reapproved. |

### 8.3 Secrets policy

- Secrets stay in env/secret manager or `integration_secrets`; catalog marks them `is_secret`.
- Settings UI shows only “Not configured / Configured / Rotated on …”.
- Public view excludes all secrets by definition (`is_public AND NOT is_secret`).
- Per-org Razorpay credentials must replace global env keys before multi-tenant go-live.
- Rotate every service-role and Postgres credential that has appeared in a tracked file or Git history; update deployment secret managers and ignored local env files. Repo-side literals have been replaced with `process.env.*` guards and stale `.next`/`.turbo`/`.playwright-mcp` caches are purged, but rotation and a coordinated history purge remain external release gates.

---

## 9. Phase 0 — stabilization before settings work

These are blocking defects found during the audits. Fix and verify in staging first.

| # | Blocker | Code/SQL status | Remaining release gate |
|---|---|---|---|
| S1 | Grants collision | `20270101000000_complete_grants_allowlist.sql` revokes 13 exact-signature service/scheduler RPCs from `public`, `anon`, `authenticated` and grants `service_role`; `rls_audit.sql` asserts grants, SECURITY DEFINER and safe-wrapper exceptions. `next_code()` is hardened by `20270101000030_next_code_org_guard.sql`. | Apply both forward migrations in staging and run `rls_audit.sql`; no live database was changed. |
| S2 | `place_sale` regression | `20261231000000_phase2_effective_settings.sql` restores org binding, advisory lock, discount override, storefront `p.org_id`, explicit org propagation and settings-driven tax/quote/lab/supply values; `place_sale_staging.sql` supplied. | Apply and run the staging suite, including replay and cross-org probes. |
| S3 | Rx approval trigger conflict | `20270101000010_prescription_approval_resolution.sql` keeps strict `require_approved_sale_prescription`, disables tolerant `trg_sales_rx_valid`, adds `set_prescription_review()`, audited conservative backfill and immutable Rx audit log; review UI wired. | Apply and run `prescription_approval.sql`; approve/backfill real rows only in staging after business review. |
| S4 | Invalid seed JSON | `seed_finance.sql` strings quoted correctly in source. | Confirm the seed applies in a scratch DB. |
| S5 | Service-role/Postgres secrets in workspace | All tracked literal credentials replaced with `process.env.*` guards; RLS-off root scripts gated; stale caches purged. Ignored local env files still need external rotation and history remains compromised. | Rotate service-role/Postgres credentials in provider/deployment secret manager, update local env files, then coordinate a history purge with all clones/forks. |
| S6 | Pending/unverified migrations | Full forward stream supplied, including settings, grants, Rx, phone merge and `next_code` guard. | Apply in filename order to a fresh staging clone with backup; reconcile live schema drift; never hand-mark failed migrations applied. |
| S7 | Duplicate customer phone | `20270101000020_customer_phone_merge.sql` keeps `CUS-0006`, retains `CUS-0007` with empty phone/`merged` status, rebuilds the unique index and writes an audit row; `customer_merge.sql` supplied. | Apply and run the merge verification in staging. |
| S8 | RBAC fixtures missing | `rbac_role_fixtures.sql` and `rbac_non_owner_access.sql` cover owner, admin, `branch_manager`, cashier, optometrist, staff and cross-tenant IDOR; `rbac_rls.test.sql` and `branch_access.sql` include the fixtures. | Seed and run in an isolated migrated DB; no literal `manager` role. |
| S9 | Documentation conflict | Resolved in `SETUP.md`, `GO_LIVE_CHECKLIST.md`, `WEBSITE_SETUP.md`, `docs/API.md`, this plan and the roadmap: catalog `write_role`/`write_permission` is authoritative; owner/admin write unless key is owner-only. | Verify against the applied catalog in staging and keep docs aligned at release. |

Verification for Phase 0: `pnpm verify:migrations`, per-app `tsc --noEmit`, SQL `rls_audit.sql`, fresh staging database reset/push, and build in CI/Linux (local Windows turbo has a known `spawn UNKNOWN` issue).

---

## 10. Delivery phases

Indicative sequencing; each phase ends with tests and a staging smoke test.

### Phase 1 — Foundation (read-only first)

- Add `20261229000000_settings_control_plane.sql` with catalog, branch/user settings, change requests and history view.
- Add `packages/settings` with keys, defaults, schemas, module registry and resolver.
- Refactor `apps/erp/src/lib/settings.ts` into an adapter over the resolver; preserve the current `AppSettings` shape temporarily.
- Replace `/settings` hardcoded section list with catalog-driven rendering; keep existing section components for complex editors.
- Add `/settings/modules` as a read-only effective-value and module-status inspector first.
- Wire settings audit history view.

**Exit:** no behavior change; every existing setting is listed with key, value, source, scope and editor link.

### Phase 2 — Core business settings

- Namespaced keys for tax, numbering, sales/lab, business/branch, website contact.
- Fix `place_sale` (Phase 0 S2) to read org-bound settings and settings-driven supply defaults.
- Wire GST, discount, quote validity, lab lead days and prefixes through resolver + DB.
- Add owner-only approval for tax/GSTIN, prefixes and module toggles.
- Wire stub sections (hours, security, branding) into real catalog-backed editors.

**Exit:** changing a setting in ERP changes the corresponding ERP behaviour immediately; historical documents unaffected.

### Phase 3 — Module control and RBAC

- Implement `MODULES` registry with canonical `module.<key>` keys. Older `module.<key>.enabled` documentation is stale.
- Apply to sidebar, TopBar quick actions, `routeAllowed()`, middleware, command palette and print routes.
- Add `withModuleGuard()` to server actions and `assert_module_enabled()` to critical RPCs.
- Align `write_role/write_permission` with `role_permissions`; fix duplicated permission list in `staff/actions.ts`.
- Add impact preview before disabling POS/finance/lab.

**Exit:** toggling a module off hides navigation, denies direct URLs, rejects server actions and rejects DB RPCs.

### Phase 4 — Storefront control plane

- Add `public_storefront_settings` and `/api/revalidate`.
- Add `getStorefrontConfig()` and `StorefrontConfigProvider`.
- Replace hardcoded checkout/cart/product/chrome/referral/review/lens values with resolver values.
- Wire ERP Website Studio + new Storefront Settings section into the same catalog.
- Add feature modes: eye-test booking (`whatsapp|database|hybrid`), Rx upload (`whatsapp|upload`), persistent cart, reviews enabled.
- Gate demo/signup via platform settings; remove insecure `demo_mode` cookie bypass.

**Exit:** an owner can change storefront branding, commerce policy, payment methods, content visibility and feature modes from ERP without code changes.

### Phase 5 — Workflows, integrations and reliability

- Centralize Rx approval/expiry, CRM automation, appointment rules, lab SLA, repair warranty, purchase approvals, finance close rules and payroll policy.
- Move per-org Razorpay/webhook, OCR, WhatsApp, SMTP and Google Drive credentials into `integration_secrets` with catalog metadata.
- Add maintenance mode with safe behaviour: public reads show a friendly page, writes blocked, health endpoint still up.
- Add backup schedule/retention and doc-link TTL settings.

### Phase 6 — Governance and rollout

- Approval queue UI for `requires_approval` keys.
- Settings import/export (JSON, redacted secrets) for staging/production parity.
- Full audit/history UI with old/new diff and rollback to previous value (not previous transaction data).
- Documentation: update `SETUP.md`, `WEBSITE_SETUP.md`, `GO_LIVE_CHECKLIST.md`, `docs/API.md` and this plan with final key names.
- Staging soak, then production inside a maintenance window.

---

## 11. Testing strategy

### SQL / database

- `supabase/tests/rls_audit.sql` must still pass after grants fix.
- New `supabase/tests/settings_control_plane.sql`:
  - tenant A cannot read/write tenant B settings;
  - staff cannot write owner-only keys;
  - branch override cannot escape branch;
  - public projection never returns `is_secret` or non-allowlisted keys;
  - disabled module RPC rejects;
  - audit row exists for every setting write;
  - history view is read-only.

### Unit

- resolver defaults → org → branch precedence;
- unknown/malformed values fail closed;
- Zod/JSON Schema validation for every key;
- module registry dependencies and `routeAllowed()` matrix;
- effective-date/snapshot helpers.

### E2E (isolated DB only, `RUN_MUTATING_E2E=1`)

- For each module: toggle off → nav hidden → direct URL denied → server action rejected → RPC rejected → toggle on restores.
- GST change: old invoice/receipt unchanged, new sale uses new setting.
- Prefix change: new CUS/ORD/LAB/CN numbers use new prefix; old IDs unchanged.
- Storefront: change branding, delivery fee, payment methods, SEO and section visibility; verify after revalidation.
- Booking mode: WhatsApp vs database mode creates expected ERP appointment behaviour.
- Maintenance mode: reads show banner, writes blocked, health check green.

### Commands

```powershell
pnpm verify:migrations
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm exec playwright test --project=erp
pnpm exec playwright test --project=web
```

Run `pnpm build` in CI/Linux; the local Windows turbo runner has a known `spawn UNKNOWN` issue.

---

## 12. Proposed files and migrations

| Area | Files |
|---|---|
| DB | `supabase/migrations/20261229000000_settings_control_plane.sql`, `supabase/tests/settings_control_plane.sql` |
| Shared | `packages/settings/src/{index,keys,defaults,schemas,modules,types,server,public,errors}.ts`, `packages/settings/package.json`, update `pnpm-workspace.yaml`/app manifests/Next configs |
| ERP resolver | `apps/erp/src/lib/settings.ts` becomes adapter; new `apps/erp/src/lib/settings-guard.ts`, `apps/erp/src/lib/module-guard.ts` |
| ERP UI | `settings/view.tsx`, `settings/ui.tsx`, new `settings/section-modules.tsx`, `settings/section-storefront.tsx`, `settings/section-security.tsx`, `settings/section-branding.tsx`, `settings/section-hours.tsx`, `settings/section-integrations.tsx` |
| ERP enforcement | `lib/rbac.ts`, `middleware.ts`, `components/Sidebar.tsx`, `components/Shell.tsx`, `components/CommandPalette.tsx`, module server-action wrapper |
| Storefront | `apps/web/src/lib/storefront-config.ts`, `apps/web/src/lib/site.ts` adapter, `components/storefront-config.tsx`, `api/revalidate/route.ts`, checkout/cart/product/chrome/lens/referral/review consumers |
| Docs | this file, `SETUP.md`, `WEBSITE_SETUP.md`, `GO_LIVE_CHECKLIST.md`, `docs/API.md` |

---

## 13. Recommended next step

Start with **Phase 1 only**: add the catalog migration and shared resolver behind the current UI, with everything still behaving as today. That gives a reversible foundation and an effective-value inventory before any behaviour is switched over. Phase 0 blockers must be fixed in staging before Phase 2 changes money, clinical or access behaviour.

---

## 14. Phase 1 implementation status (2026-11-27)

**Status: code-complete, database migration NOT applied.** This pass stayed read-only against the live database.

Delivered:

- `supabase/migrations/20261229000000_settings_control_plane.sql` — catalog, org/branch/user value stores, change requests, validation/authority helpers (`validate_setting_value`, `can_write_setting`), public/history projections, RLS and audit triggers. No existing value is rewritten and no trigger blocks writes in Phase 1.
- `supabase/tests/settings_control_plane.sql` — transactional SQL checks for catalog seeds, validation, public-secret exclusion and history projection. Run against a scratch database only.
- `packages/settings` — shared keys, defaults, schemas, module registry, fail-closed resolver, public projection and error types.
- `apps/erp/src/lib/settings-catalog.ts` — ERP `SettingsDataSource` and `getSettingsSnapshot()`. `apps/erp/src/lib/settings.ts` is a compatibility adapter returning the exact legacy `AppSettings` shape/coercion. During Phase 1 it read only `org_settings`; Phase 2 supersedes that with the full resolver (see §15).
- `apps/erp/src/app/(app)/settings/modules/page.tsx` — read-only effective-value and module inspector, linked from the existing Settings rail. It falls back to the built-in catalog until the DB migration is applied.
- Workspace/lockfile wiring for `@poweros/settings` in both apps, including `transpilePackages` updates.
- Follow-up hardening: `20261230000000_settings_hardening.sql` restores the settings audit actor and revokes tenant/service-only RPCs reopened by the earlier blanket grants; `settings_change_history` now uses `security_invoker`, and the effective-value inspector is owner/admin-only.

Verification completed without touching the live database:

- `pnpm install` — linked the new workspace package.
- `pnpm verify:migrations` — 91 unique migration versions; no duplicate prefixes.
- `pnpm --dir apps/erp exec tsc --noEmit` — clean.
- `pnpm --dir apps/web exec tsc --noEmit` — clean.
- `git diff --check` — no whitespace errors (only existing CRLF/LF normalisation warnings).

Deliberately deferred: catalog-driven replacement of the hardcoded `/settings` section rail, enforcement gates, approval workflows, storefront consumers and all behaviour-changing wiring. These remain Phase 2+ so Phase 1 is reversible. The SQL migration and its test must be run in staging before any runtime verification is claimed.

---

## 15. Phase 2 implementation status (2026-11-27)

**Status: code and forward SQL supplied; migration NOT applied; runtime behaviour NOT verified.** All work remains uncommitted/untracked. No live database records or schema were changed.

Delivered in the safe Phase 2 slice:

- `apps/erp/src/lib/settings-catalog.ts`
  - `erpSettingsSource(client?)` accepts an injected client for service-role/print contexts.
  - `getSettingsSnapshot({ allowedSources, context, client })` accepts explicit org/branch/user overrides.
  - `legacyAppSettingsFrom()` now reads validated `snapshot.values` instead of compatibility-only `rawValues`.
- `apps/erp/src/lib/settings.ts` — `getSettings()` now uses the full resolver; legacy keys still work through catalog aliases, so existing `AppSettings` callers keep their contract.
- `apps/erp/src/app/(app)/sales/page.tsx` — removed the duplicate raw `quotation_valid_days` query; passes resolver-backed `maxDiscount` and the caller's `role` into `SalesView`/`Pos`.
- `apps/erp/src/app/(app)/sales/pos.tsx` — discount input is capped by `sales.max_discount_pct` for staff; owner/admin retain the existing 100% override that SQL already enforces.
- `apps/erp/src/app/print/sale/[id]/page.tsx` — uses the resolver with explicit `orgId`/`branchId` and the print service client for GSTIN/footer/quote-days fallbacks. Historical sale values remain primary so old documents are not rewritten by later settings changes.
- `apps/erp/src/app/(app)/settings-actions.ts` — writer fallbacks aligned with catalog defaults (`maxDiscount` 10, quote days 14). Writers still write legacy `org_settings` keys because SQL readers are being migrated in this phase, not before it.
- `supabase/migrations/20261231000000_phase2_effective_settings.sql` — **supplied, not applied**. Adds:
  - `public.effective_setting(org, key, branch)` with canonical-first/legacy-fallback resolution, validation, org binding and fail-closed defaults;
  - `place_sale(jsonb)` rewritten to use validated tax/discount/quote/lab/supply values, restore the idempotency advisory lock, bind to `p.org_id` for service-role storefront calls, write the resolved org id on sales/lines/payments/stock/lab rows, and reject cross-org ids;
  - `next_code(org, key, prefix)` rewritten to prefer `numbering.code_prefixes` with legacy `code_prefixes` fallback.
- `supabase/tests/settings_control_plane.sql` — extended with Phase 2 checks for legacy resolution, canonical precedence, invalid-value fallback and both legacy/canonical numbering paths.

Verification after Phase 2 code edits:

- `pnpm --dir apps/erp exec tsc --noEmit` — clean.
- `pnpm --dir apps/web exec tsc --noEmit` — clean.
- `pnpm verify:migrations` — 92 unique migration versions after adding the Phase 2 migration.
- `git diff --check` — no whitespace errors; CRLF/LF normalization warnings only.

Still required before Phase 2 can be called complete:

- Apply `20261229000000_settings_control_plane.sql`, `20261230000000_settings_hardening.sql` and `20261231000000_phase2_effective_settings.sql` to a fresh staging clone, in order, with a backup.
- Run `supabase/tests/settings_control_plane.sql` and the RLS/grant audit in that scratch database.
- Exercise GST on/off, old-vs-new invoice immutability, quote validity, lab due dates, discount overrides, prefix changes, idempotent replay, concurrent replay and storefront `p.org_id` sales.
- Keep legacy/dual writes until those tests prove `place_sale` and `next_code()` read canonical values correctly.

Deferred by design: stubs for hours/security/branding have no canonical keys yet, service tax `18` and home-state semantics need product/accountant confirmation, and full Phase 3–6 enforcement remains pending. See `docs/PHASE2_6_PRODUCTION_READINESS_ROADMAP.md`.

---

## 16. Phase 0 closure status (2026-11-27)

**Status: code, forward migrations and staging tests supplied; nothing applied to
live or staging; no database record changed.** The release verdict remains
**NO-GO** until staging evidence and credential rotation exist.

Added after §15:

- `20270101000000_complete_grants_allowlist.sql` — exact-signature 13-function service-only allowlist and self-check.
- `20270101000010_prescription_approval_resolution.sql` — one enabled strict Rx gate, disabled tolerant trigger, review RPC, conservative audited backfill and immutable Rx audit log.
- `20270101000020_customer_phone_merge.sql` — audit-preserving merge for `CUS-0006`/`CUS-0007` and rebuilt unique phone index.
- `20270101000030_next_code_org_guard.sql` — direct session-org binding and input validation for the authenticated-callable `SECURITY DEFINER` counter writer.
- `supabase/tests/rls_audit.sql` — expanded structural and functional grant/RLS audit, including safe-wrapper exceptions and a real `service_role` probe.
- `supabase/tests/place_sale_staging.sql`, `prescription_approval.sql`, `customer_merge.sql`, `rbac_role_fixtures.sql`, `rbac_non_owner_access.sql` — isolated staging suites; branch/role and SaaS checkout suites were extended.
- ERP prescription review action/UI and subscription-invoice printer now use the service client only after tenant RLS verifies the invoice.
- All tracked credential literals were replaced with environment guards; RLS-off root scripts now refuse to run without an explicit disposable-environment flag; stale caches were purged.

Local verification after these edits: `pnpm verify:migrations` reports 96 unique
versions; both apps' `tsc --noEmit` are clean; `pnpm test:unit` passes 55/55;
`node --check` is clean for all tracked `.mjs` files; `git diff --check` reports
no whitespace errors (CRLF/LF normalization warnings only). A tracked-file scan
finds no service-role or credentialed database URL values; the only remaining
JWT-shaped value is the public anon key in `scripts/qa-anon.mjs`.

Required staging sequence: fresh clone + backup, apply migrations in filename
order, then run `rls_audit.sql`, `settings_control_plane.sql`,
`place_sale_staging.sql`, `customer_merge.sql`, `prescription_approval.sql`,
`rbac_non_owner_access.sql`, branch/role/subscription/break-glass suites and
mutating Playwright with `RUN_MUTATING_E2E=1`. Rotation of exposed credentials
is external and must complete before any release reconsideration.
