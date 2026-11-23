# PowerOS — Manual QA Execution Report

**Date:** 2026-11-23
**Environment:** http://localhost:3001 (ERP, dev) · Supabase `lnoagnobwrptbcdeshji`
**Tester:** AI agent (Chrome DevTools + DevTools network/console + SQL verification)
**Logged in as:** Power Eyes Owner (role `owner`, org `Power Eyes Opticals` = `00000000-0000-0000-0000-000000000001`)
**Test data convention:** records created by this run use the prefix `QA-` / phone range `97xxxxxxx` so they can be identified and cleaned up.

**Status legend:** PASS · FAIL · BLOCKED · NOT TESTED

> Execution follows the recommended order (section 16 of the test plan).
> This file is updated incrementally as stages complete.

## Stage summary

| # | Stage | Status | Notes |
|---|-------|--------|-------|
| 1 | Authentication and tenant isolation | IN PROGRESS | |
| 2 | Customer and appointment | NOT TESTED | |
| 3 | Examination and prescriptions | NOT TESTED | |
| 4 | PALRE and LPIMS | NOT TESTED | |
| 5 | Orders and payments | NOT TESTED | |
| 6 | Lab, workshop and QC | NOT TESTED | |
| 7 | Repairs and delivery | NOT TESTED | |
| 8 | Inventory and procurement | NOT TESTED | |
| 9 | Finance and GST | NOT TESTED | |
| 10 | RBAC and multi-branch | NOT TESTED | |
| 11 | Subscription | NOT TESTED | |
| 12 | Performance, security, regression | NOT TESTED | |

## Bugs found

### BUG-001 — Critical — Creating a new organization always fails (DB trigger drift)
- **Test:** §12 Create a new organization / §13 foreign-key & tenant fixtures.
- **Steps:** `insert into organizations (id, name) values ('2222…','QA Tenant B')` (service role, same path as `apps/erp/src/app/platform/actions.ts:89`).
- **Actual:** `ERROR: record "new" has no field "id"` — raised inside `audit_row()` from trigger `trg_roleperm_audit` on `role_permissions`, invoked by `seed_org_permissions()` from `trg_org_seed_permissions`.
- **Root cause:** live table `role_permissions` has **no `id` column** (PK is `org_id+role_key+permission`), but migration `20261123000000_tenant_perms_ratelimit.sql` created trigger `trg_roleperm_audit` (line 76) which assumes `coalesce(new.id, old.id)`; the `alter table role_permissions add column id …` (line 70) is **not present in the live database** → migration drift. The insert rolls back (verified: `organizations` still has 1 row).
- **Impact:** platform "Create company", tenant signup and any test-fixture org creation fail. Blocks cross-tenant (§10/§13) testing until fixed.
- **Severity:** Critical (SaaS blocker).

---
