# foreign/

Retired code that is **not part of the app** and must never be re-registered.

These files target a foreign schema (`staff_profiles`, `subscription_plans`,
`tenant_id`) that does not exist in this codebase. They used to live under
`src/app/api/subscription/`, where Next.js registered them as live routes that
would throw at runtime. They are kept here for reference only — mirrors the
`supabase/migrations/disabled/` convention.

Do not import anything from this folder.
