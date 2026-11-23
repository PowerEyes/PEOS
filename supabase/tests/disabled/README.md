# tests/disabled/

Test files parked here target the **foreign schema** (`tenants`, `tenant_id`,
`user_branches`, `staff_profiles`) that no longer exists — they cannot pass against
this codebase and would only fail the suite.

- `multi_branch_rbac.test.sql` — drives `user_branches`, created only by
  `migrations/disabled/20261122000000_multi_branch_rbac.sql`.
- `tenant_isolation/01_cross_tenant_read.sql` — drives `tenants` and
  `customers.tenant_id`.

Cross-tenant isolation and branch scoping for the real schema are covered by
`rbac_rls.test.sql` and `branch_access.sql`; platform scope and subscription
lifecycle by `saas_platform.sql` and `saas_checkout.sql`.

Mirrors `supabase/migrations/disabled/`. Do not run these in CI.
