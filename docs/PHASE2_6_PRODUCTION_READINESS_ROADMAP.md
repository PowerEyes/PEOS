# PowerOS Phase 2–6 roadmap and production-readiness gate

**Date:** 2026-11-27  
**Scope of this pass:** static/code review and reversible code authoring only. No migration was applied and no live database record was changed. `apps/erp/foreign/` is retired and excluded.

## 1. Current verdict

**NO-GO / NOT PRODUCTION-READY.**

Release evidence used:

- `docs/POWEROS_COMMERCIAL_PRODUCTION_AUDIT.md` — **NO-GO**, P0 gates required.
- `docs/ADVANCED_TEST_REPORT.md` — 203 scenarios: **43 PASS / 56 PARTIAL / 79 FAIL / 24 BLOCKED / 1 N/A**.
- `docs/PRODUCTION_READINESS_ASSESSMENT.md` — **24% readiness**, not production-ready.
- `docs/QA_EXECUTION_REPORT_2026-11-23.md` — live schema drift and org-creation blocker.

`docs/FINAL_PRODUCTION_READY_REPORT.md` is **superseded/invalid** and must not be used as release evidence.

The Phase 1 settings foundation and the Phase 2 slice in this pass are **uncommitted/untracked**, their migrations are **not applied**, and runtime behaviour is **unverified**. They are not a release candidate.

---

## 2. What was actually delivered in this pass

### Phase 1 foundation (already authored earlier)

- `packages/settings` — canonical keys, defaults, schemas, module registry, fail-closed resolver, public projection.
- `supabase/migrations/20261229000000_settings_control_plane.sql` — catalog, value stores, change requests, validation/authority helpers, projections, RLS and audit triggers.
- `supabase/migrations/20261230000000_settings_hardening.sql` — restores settings audit actor and revokes sensitive RPCs reopened by the earlier blanket grant.
- `apps/erp/src/lib/settings-catalog.ts` and `apps/erp/src/lib/settings.ts` adapter.
- Owner/admin-only effective-value inspector at `apps/erp/src/app/(app)/settings/modules/page.tsx`.
- `settings_change_history` now uses `security_invoker` plus owner/`audit.read` filter.

### Phase 2 code and supplied SQL (this pass)

Delivered:

- Resolver context/client overrides in `apps/erp/src/lib/settings-catalog.ts`.
- Validated `snapshot.values` in the legacy `AppSettings` adapter.
- Full-resolver `getSettings()`; legacy keys still resolve through catalog aliases.
- Sales page: duplicate `quotation_valid_days` query removed; `maxDiscount` and `role` passed to `Pos`.
- POS: staff discount capped by `sales.max_discount_pct`; owner/admin keep the 100% override already enforced in SQL.
- Print sale page: resolver-backed GSTIN/footer/quote-days fallback with explicit org/branch context; historical sale values stay primary.
- Writer defaults aligned to catalog: max discount 10, quote days 14. Writers remain legacy/dual-write until SQL readers are proven.
- `supabase/migrations/20261231000000_phase2_effective_settings.sql` — **supplied, not applied**:
  - `public.effective_setting(org, key, branch)` — canonical-first, legacy fallback, validation, org binding, fail-closed defaults.
  - `place_sale(jsonb)` — validated tax/discount/quote/lab/supply values, advisory lock restored, `p.org_id` accepted only for service-role/storefront calls, resolved org id written explicitly to sales/lines/payments/stock/lab rows, cross-org customer/branch/Rx/quotation rejected.
  - `next_code(org, key, prefix)` — prefers `numbering.code_prefixes`, falls back to legacy `code_prefixes`.
- `supabase/tests/settings_control_plane.sql` — Phase 2 assertions for legacy resolution, canonical precedence, invalid-value fallback and numbering.
- `supabase/seed/seed_finance.sql` — bare strings in `jsonb` inserts quoted correctly. Seed is source only; nothing was executed.

### Phase 0 closure artifacts (this pass)

Delivered, all uncommitted/unapplied:

- `20270101000000_complete_grants_allowlist.sql` — 13 exact-signature service/scheduler-only RPCs; tenant-safe wrappers and guarded Phase 2 RPCs keep grants.
- `20270101000010_prescription_approval_resolution.sql` — one strict enabled Rx gate, tolerant trigger disabled, `set_prescription_review()`, conservative audited backfill and immutable Rx audit log. ERP review action/UI wired.
- `20270101000020_customer_phone_merge.sql` — `CUS-0006` survivor, `CUS-0007` retained as `merged` with empty phone, audited and unique index rebuilt.
- `20270101000030_next_code_org_guard.sql` — direct session-org binding and input validation for the authenticated-callable `SECURITY DEFINER` counter writer.
- Staging suites: `place_sale_staging.sql`, `prescription_approval.sql`, `customer_merge.sql`, `rbac_role_fixtures.sql`, `rbac_non_owner_access.sql`; expanded `rls_audit.sql`, `rbac_rls.test.sql`, `branch_access.sql` and `saas_checkout.sql`.
- Subscription-invoice printing fetches service-only billing identity through `supabaseBilling()` only after tenant RLS verifies the invoice.
- All tracked credential literals replaced with `process.env.*` guards; RLS-off root scripts now require an explicit disposable-environment flag; stale caches purged. Provider-side rotation and history purge remain external.

Verification completed:

| Check | Result |
|---|---|
| `pnpm --dir apps/erp exec tsc --noEmit` | clean |
| `pnpm --dir apps/web exec tsc --noEmit` | clean |
| `pnpm test:unit` | 55 pass / 0 fail |
| `node --check` on all tracked `.mjs` files | clean |
| `pnpm verify:migrations` | 96 unique migration versions after the Phase 0 closure migrations |
| `git diff --check` | no whitespace errors; CRLF/LF normalization warnings only |
| Scan of tracked files for credential-shaped literals | no service-role or credentialed DB URL values; only the public anon JWT in `scripts/qa-anon.mjs` remains |

Not verified: migration apply order, RLS/grant behaviour, database triggers, runtime sales, storefront checkout, or any mutating scenario.

---

## 3. Phase 0 blockers before any enforcement

| # | Blocker | Status after this pass | Required action |
|---|---|---|---|
| S1 | Blanket `SECURITY DEFINER` grant in `20261222000000_harden_grants.sql` | **Code complete, staging pending.** `20270101000000` replaces the partial seven-name rollback with a 13-function exact-signature allowlist; `rls_audit.sql` asserts tenant deny, service grant, SECURITY DEFINER and safe-wrapper exceptions. | Apply the forward migration; run `rls_audit.sql` and break-glass probes on staging. |
| S2 | `place_sale` regression | **Code complete, staging pending.** Forward SQL restores org binding, advisory lock, discount override, settings-driven tax/lab/quote/supply values, storefront `p.org_id` and cross-org rejection; `place_sale_staging.sql` supplied. | Apply in staging and run the full sale suite, including replay and old-invoice immutability. |
| S3 | Rx trigger conflict | **Code complete, staging pending.** Strict gate is authoritative, tolerant trigger disabled, review RPC/UI and audited conservative backfill supplied. | Apply and run `prescription_approval.sql`; business review before real backfill; keep root approval script retired. |
| S4 | Invalid JSON in `supabase/seed/seed_finance.sql` | Fixed in source. | Confirm seed applies in a scratch DB. |
| S5 | Exposed service-role/Postgres credentials in tracked scripts, ignored local env files and stale bundles | **Repo side done; external rotation pending.** Tracked literals sanitized to env guards, RLS-off scripts gated, caches purged. Git history still contains old values. | Rotate credentials in provider/secret manager, update local env files, coordinate history purge with all clones/forks. |
| S6 | Pending/unapplied migrations and live schema drift | **Unresolved.** Live snapshot missing 16 tables, 31 functions, 16 triggers, 26 policies and 55 grants. | Apply full stream in a fresh staging clone with backup; never hand-mark failures applied. |
| S7 | Duplicate customer phone `9000000001` on `CUS-0006`/`CUS-0007` | **Code complete, staging pending.** Audit-preserving merge and verification SQL supplied. | Apply and run `customer_merge.sql` in staging before relying on the unique phone index. |
| S8 | RBAC fixtures missing; all available profiles are `owner` | **Code complete, staging pending.** Reusable fixtures and non-owner/cross-tenant suites supplied; no literal `manager` role. | Seed fixtures in an isolated migrated DB and repeat access tests. |
| S9 | Documentation/code conflict: `SETUP.md` says admin cannot change org settings; code allows owner/admin | **Resolved in docs.** Catalog `write_role`/`write_permission` is authoritative; `admin` is company manager, `branch_manager` is branch manager; owner-only keys remain owner-only. | Verify against the applied catalog during staging and keep release docs aligned. |

Additional data blockers:

- Prescriptions: 3 rows missing VA from `eye_examinations`.
- Customers: 4 rows missing `branch_id`.
- `ORD-0003`: refund mismatch (`CN-0001` exists but sale still shows `paid_total = 3000` / `payment_status = paid`) needs accountant review.
- `role_permissions.id` drift breaks `trg_roleperm_audit` and org creation.
- GST statutory filing/export needs accountant sign-off.

---

## 4. Phase 3 — module toggles across UI, middleware, actions and RPCs

**State: partially implemented in uncommitted code; staging/runtime unverified.** Canonical key format is `module.<key>`; documentation saying `module.<key>.enabled` is stale. Module helpers, nav/middleware/action guards and SQL assertions are authored, with `/settings/modules` and settings writers deliberately exempt so an owner can re-enable a module. All module definitions default to `true`, and missing/invalid values fail open while the migration is unapplied.

### Implementation order

1. **Pure helpers (Edge/client safe)**
   - `apps/erp/src/lib/module-routes.ts` — `moduleForPath()`, `moduleRouteAllowed()`, `filterByModuleFlags()`; longest-prefix map for `/sales`, `/inventory`, `/finance`, `/purchases`, `/staff`, `/payroll`, `/crm`, `/appointments`, `/prescriptions`, `/workshop`, `/repairs`, `/website`, `/branches`, `/platform`.
   - `apps/erp/src/lib/module-flags.ts` — `flagsFromSnapshot()`, `isModuleEnabled()`, `enabledModuleKeys()`.
   - Do **not** import `settings-catalog.ts`, `next/headers`, or `supabaseServer()` into middleware/client components.

2. **Server guard**
   - `apps/erp/src/lib/module-guard.ts` — `moduleGate(moduleKey)`, `assertModuleEnabledForRequest()`, `withModuleGuard()`.
   - Match the existing `subscriptionGate()` pattern: `const gate = await moduleGate("sales"); if (gate) return gate;`.

3. **UI filtering**
   - `lib/nav.ts` — add `module?: string`, extend `visibleNav(user, flags)`.
   - `Sidebar.tsx`, `Shell.tsx`, `TopBar.tsx`, `QuickCreate.tsx`, `CommandPalette.tsx`, `shell-actions.ts` — pass and apply flags; hide badges/counts for disabled modules.
   - `app/(app)/layout.tsx` — add `getModuleFlags()` to the existing `Promise.all`; pass flags, not the full snapshot, to client components.

4. **Middleware**
   - ERP `middleware.ts` — add `org_id` to profile select, load flags from the request-scoped Supabase client, check `moduleRouteAllowed(path, flags)` before the `/platform` RBAC bypass.
   - Print `?dt=` links must remain public by design; authenticated print routes inherit module prefixes.

5. **Server actions and RPCs**
   - Add module gates to the action files identified in the audit: sales, inventory, finance, staff, customers, CRM, appointments, prescriptions, purchases, workshop, repairs, payroll, website, integrations and web orders.
   - SQL forward migration: `module_enabled(module, org)` and `assert_module_enabled(module, org)` with explicit grants; then gate critical RPCs including `place_sale`, `cancel_order`, `deliver_order`, `create_credit_note`, payroll RPCs, transfer/audit RPCs, exam/lab/repair advancement and website restore.
   - Never gate `/settings/modules`, the owner-only toggle writer, or the settings rail link; owners must be able to re-enable modules.

### Rules

- Module flags are an additional org-wide on/off layer, **not** a replacement for `routeAllowed()`, `has_perm()` or RLS.
- Decide replay policy before gating `place_sale`: if disabled POS should reject replays, gate before replay handling; if in-flight payments must complete, gate after the idempotent return.
- Tests: for each module — flag off → nav hidden → direct URL denied → action rejected → RPC rejected → flag on restores.

---

## 5. Phase 4 — storefront config resolver and hardcoded-value removal

**State: partially implemented in uncommitted code; staging/runtime unverified.** `public_storefront_settings` and resolver-backed components are supplied, and audited hardcoded copy/branding paths were migrated. Money/payment paths, feature gates, revalidation and the remaining literal inventory still require an applied migration and runtime verification before this phase can be closed.

### Implementation order

1. **Register new public keys** in `packages/settings/src/keys.ts`, `defaults.ts`, schemas and the migration seeds:
   - `checkout.delivery_fee`, `checkout.free_shipping_threshold`, `checkout.payment_methods`, `checkout.cod_enabled`, `checkout.trust_copy`, `checkout.tracking_steps`.
   - `customers.allowed_states`.
   - `commerce.currency` as a public alias; keep `business.currency` non-public/INR-only.
   - `lens.usage_options`, `lens.steps`, `lens.configurator_enabled`.
   - `reviews.enabled`, `reviews.min_length`, `reviews.auto_approve`, `reviews.moderation_copy`.
   - `loyalty.referral_points`, `loyalty.referee_discount`.
   - `website.site_url`, `website.theme_color`, `website.seo_description`, `website.locale`.
   - `platform.demo_enabled`, `platform.signup_enabled`.

2. **Create one resolver** — `apps/web/src/lib/storefront-config.ts` — using `resolveSettings()` + `toPublicSettings()` or the hardened public view. Return typed sections: branding, commerce, checkout, payment, tracking, lens, reviews, loyalty, platform.

3. **Consolidate providers** — adapt `SiteProvider`/`ChromeProvider` rather than adding a third fetch layer. Mount once in `apps/web/src/app/layout.tsx`; keep Razorpay secrets server-only.

4. **Switch low-risk copy first** — trust copy, tracking labels, branding/theme/SEO/locale, hours, lens/review/referral copy. Preserve current defaults byte-for-byte.

5. **Switch money/payment paths together**
   - `/api/checkout`, `/api/order-confirm`, `/api/coupon`, cart/checkout product copy and Razorpay display must resolve from the same config.
   - Keep `/api/checkout` authoritative; client totals are presentation-only.
   - Historical orders must validate stored quotes, not current settings.
   - Fix the current mismatch: copy promises free shipping above ₹999 but the API always charges delivery.

6. **Add secured revalidation** — `POST /api/revalidate` with shared-secret verification and org-scoped tags; emit `settings:<orgId>` / `storefront:<orgId>` on writes.

7. **Enforce gates server-side**
   - Reviews: API/RLS/RPC, not just hidden UI (`ReviewForm.tsx` currently inserts directly).
   - Demo/signup flags: check in API routes and middleware. The insecure `demo_mode` cookie bypass has been removed in this pass, but `/api/demo` and `/api/signup` still need real flags.

### Tests

Public/secret exclusion, schema-validated JSON, client/server total parity, Razorpay vs COD confirmation, tracking-step mapping, feature gates, dynamic/static rendering, revalidation.

---

## 6. Phase 5 — workflows, integrations, maintenance mode and reliability

**State: partially implemented in uncommitted code; staging/runtime unverified.** Workflow/RPC hardening (notably prescription approval) is supplied, but integration secrets, maintenance-mode persistence, backup/doc-link settings and observability still need key registration, server-side enforcement and applied-migration evidence.

### Workflows

Add catalog keys and enforce in DB + server actions for:

- Prescriptions: approval required, approval roles, reapproval on edit, expiry days, VA/PD ranges, OCR toggle, print header.
- CRM: automation toggles, templates, provider, message modes. Move `crm_settings` reads to the resolver and restore/deploy real scheduling; current jobs are commented out or env-only.
- Appointments: slot duration, buffer, working hours, max per slot, assignment rules, reminder policy and WhatsApp/database/hybrid booking mode.
- Lab/workshop: stages, SLA/priority, due-date formula, assignment, buying-list threshold.
- Repairs: status flow, warranty days, photo requirement, templates, pickup/delivery.
- Purchases: approval limit, GRN required, payment terms.
- Finance: credit-note approval, close rules, day-close rules, closed-period lock.
- Payroll: approval and payslip override policy.

Historical invoices/orders must remain immutable when transaction-affecting settings change.

### Integrations

- Move Razorpay key secret/webhook secret, OCR token/endpoint, WhatsApp credentials and Google Drive state into `integration_secrets`; decide whether SMTP is platform- or org-scoped.
- Replace env reads in `apps/web/src/app/api/checkout/route.ts`, `apps/web/src/app/api/razorpay-webhook/route.ts`, `apps/erp/src/lib/razorpay.ts`, both OCR routes and `supabase/functions/_shared/whatsapp.ts`.
- Secret UI must show only **Configured / Not configured / Rotated on**, never raw values.
- Remove mock-success behaviour from WhatsApp before claiming delivery health.

### Maintenance mode

- Replace the UI-only `apps/erp/src/app/platform/maintenance/page.tsx` with persisted system-scope keys.
- Enforce in both middlewares, exempting health, auth reset and public document links.
- Block writes in DB/server actions/APIs; reads show a friendly banner.
- Add the platform nav link to `apps/erp/src/app/platform/layout.tsx`.

### Reliability

- Move backup folder/retention/schedule out of `apps/erp/src/lib/backup.ts` and `apps/erp/vercel.json`.
- Move document-link TTL/maxViews out of `apps/erp/src/lib/doclinks.ts`.
- Add audit retention and log level; wire observability (Sentry configs are currently commented out).
- Define and test offline POS mode; it does not exist today.
- Verify deployed pg_cron jobs, Vercel cron, edge functions and secret manager state outside the repository.

---

## 7. Phase 6 — approvals, import/export, audit UI, documentation, rollout

**State: partially implemented in uncommitted code; staging/runtime unverified.** Documentation and the invalid-report exclusion are reconciled here and in the settings plan; approvals, import/export redaction, audit UI and retired-code cleanup remain pending release gates.

1. **Approval queue**
   - `public.setting_change_requests` exists but has no UI/RPC consumer.
   - Add request → approve/reject → apply → audit → revalidate for `requires_approval` keys.
   - If any `requires_approval` key is enforced before this exists, it becomes a production blocker.

2. **Import/export**
   - JSON export/import with schema validation, secret redaction, dry-run diff, owner-only authority and audit entries.
   - Never export raw secrets or restore secrets from a file.

3. **Audit/history UI**
   - Replace `settings/section-history.tsx`, which currently omits values.
   - Show old/new diff, actor, reason, source, effective time and rollback-to-previous-setting only. Never roll back transaction data.
   - Wire to `settings_change_history` after RLS verification.

4. **Per-key enforcement in settings writers**
   - `settings-actions.ts` still uses blanket `adminCtx()` + `putKeys()`.
   - Validate through `@poweros/settings`, check `can_write_setting(key)`, enforce approval/effective dating and emit revalidation tags.
   - Keep module-toggle writes ungated.

5. **Documentation**
   - Reconcile all readiness docs; mark the superseded report invalid in any release pack.
   - Update `SETUP.md`, `WEBSITE_SETUP.md`, `GO_LIVE_CHECKLIST.md`, `docs/API.md` and this plan with final keys, authority, approval policy, import/export and rollback behavior.
   - Resolve the three-way “Phase 6” label collision between settings governance, clinical website Phase 6 and localhost runtime fix docs.

6. **Retired code cleanup**
   - Exclude `apps/erp/foreign/` from deployment artifacts now; remove it from the repo post-launch.

---

## 8. Minimum production-ready checklist

Production ready means **all** of the following are true:

### Code and configuration

- [ ] Phase 0 blockers S1–S9 closed or formally waived by the release owner.
- [ ] Phase 2 SQL migration applied in staging and verified; legacy/dual writes proven safe.
- [ ] Phase 3 module gates live in UI, middleware, server actions and RPCs, with settings writers and `/settings/modules` exempt.
- [ ] Phase 4 resolver live; every audited hardcoded money/payment/content value either resolver-backed or explicitly accepted as static.
- [ ] Phase 5 workflows, integration secrets, maintenance mode and reliability settings enforced server-side.
- [ ] Phase 6 approvals, import/export redaction and audit UI present.
- [ ] All work committed, reviewed, merged and reproducible from a clean checkout.

### Security

- [ ] Service-role keys rotated; stale `.env` and `.next` material purged; no secret in `NEXT_PUBLIC_*` or client bundles.
- [ ] `rls_audit.sql`, settings-control-plane tests, branch-access, role-model, subscription and break-glass probes pass.
- [ ] Sensitive security-definer RPCs are not executable by `authenticated` or `anon`.
- [ ] Settings history viewer is owner/admin/audit-only and uses `security_invoker`.
- [ ] RBAC fixtures cover cashier, optometrist, admin (company manager), `branch_manager` and cross-tenant IDOR, not just owner; no literal `manager` role.

### Data and migrations

- [ ] Full migration stream applies cleanly to a fresh staging clone in filename order, with a backup and no manual history edits.
- [ ] Live schema drift reconciled: missing tables/functions/triggers/policies/grants restored.
- [ ] Duplicate phone merged with audit-preserving plan; unique index enabled only afterward.
- [ ] Rx rule chosen, approvals backfilled via migration, approve/reapprove UI live.
- [ ] Refund mismatch and missing VA/branch data reviewed and corrected.
- [ ] GST filing/export signed off by accountant.

### Test gates

```powershell
pnpm verify:migrations
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm --dir apps/erp exec tsc --noEmit
pnpm --dir apps/web exec tsc --noEmit
pnpm exec playwright test --project=erp
pnpm exec playwright test --project=web
```

Also required:

- Full `pnpm build` in **CI/Linux**; local Windows currently fails with turbo `spawn UNKNOWN`.
- SQL suites: `supabase/tests/rls_audit.sql`, `supabase/tests/settings_control_plane.sql`, branch/role/subscription/break-glass probes.
- Isolated BLOCKED plans from `docs/ADVANCED_TEST_REPORT.md` §9: concurrency, payment failure/recovery with Razorpay test keys, refund concurrency, IDOR/direct REST/RPC, load test, backup/restore, staging migration and rollback drill.
- Mutating Playwright only with `RUN_MUTATING_E2E=1`, a disposable DB and role fixtures.
- Per-setting on/off tests, including old-vs-new invoice immutability and prefix changes.

### Operations and evidence

- [ ] `GO_LIVE_CHECKLIST.md` updated; deployment secret manager, cron jobs, edge functions and health checks verified.
- [ ] Rollback plan rehearsed, including settings-only rollback and transaction-data non-rollback boundary.
- [ ] Release pack uses current NO-GO/PASS evidence and explicitly excludes `FINAL_PRODUCTION_READY_REPORT.md`.

---

## 9. Recommended rollout order

1. **Staging foundation**
   - Fresh DB clone + backup.
   - Fix duplicate phone and schema drift first.
   - Apply full stream through `20261228000000_website_restore_fix.sql`.
   - Apply Phase 1, hardening, Phase 2 and Phase 0 closure migrations last:
     - `20261229000000_settings_control_plane.sql`
     - `20261230000000_settings_hardening.sql`
     - `20261231000000_phase2_effective_settings.sql`
     - `20270101000000_complete_grants_allowlist.sql`
     - `20270101000010_prescription_approval_resolution.sql`
     - `20270101000020_customer_phone_merge.sql`
     - `20270101000030_next_code_org_guard.sql`
   - Run SQL tests. Do not hand-mark failed migrations applied.

2. **Close Phase 0 and security blockers**
   - Rotate exposed credentials externally; confirm caches are purged; run grants/Rx/merge/RBAC suites; reconcile docs (supplied).

3. **Phase 2 verification**
   - GST, discount, quotation, lab, numbering, idempotency, concurrent replay, storefront org binding.
   - Keep legacy/dual writes until all pass.

4. **Phase 3 module enforcement**
   - Pure helpers → UI → middleware → actions → SQL RPCs → per-module E2E.

5. **Phase 4 storefront**
   - Keys/resolver/providers → copy → money/payment paths together → revalidation → feature gates.

6. **Phase 5 workflows and reliability**
   - Keys → DB/action enforcement → secrets → maintenance mode → backup/doc-link/observability settings.

7. **Phase 6 governance**
   - Approvals → import/export → audit UI → documentation → retired-code cleanup.

8. **Release**
   - Run all gates on the merged commit in CI/Linux.
   - Deploy with secrets from the deployment manager.
   - Monitor health, settings audit, payment reconciliation and error logs.

## 10. Bottom line

The application is **not production-ready** today. The settings control plane is a reversible foundation, and the Phase 2 plus Phase 0 closure slices are code-complete with forward SQL and staging suites supplied. Nothing that changes money, access or transaction behaviour has been runtime-verified, and no migration has been applied. The remaining blockers are external credential rotation, a fresh staging apply with evidence, live schema drift, data review, and the still-blocked test plans; until those close, the verdict stays **NO-GO**.
