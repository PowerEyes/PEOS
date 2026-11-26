# foreign/

Retired code that is **not part of the app** and must never be re-registered.

These files target a foreign schema (`staff_profiles`, `subscription_plans`,
`tenant_id`) that does not exist in this codebase. They used to live under
`src/app/api/subscription/`, where Next.js registered them as live routes that
would throw at runtime. They are kept here for reference only — mirrors the
`supabase/migrations/disabled/` convention.

Do not import anything from this folder.

## Contents

- `api/subscription/*` — dead checkout/usage routes superseded by the real
  `subscription/actions.ts` + `razorpay-webhook` edge function.
- `api/*` — 10 route trees (attendance, auth/invite, branches, leave,
  onboarding/complete, platform, roles, staff, v1/customers, export) written
  against the foreign schema and referenced by nothing in `src/`.
- `dashboards/*` — the seven legacy role dashboards (owner, branch, employee,
  lab-tech, optometrist, receptionist, cashier) replaced by the single
  role-aware `/` dashboard.
- `lib/*` — orphan foreign-schema helpers (tenant, usage-tracker, feature-gate,
  subscription-guard, audit-logger, rbac-middleware, auth-guard, invitation)
  that only the parked routes imported.
