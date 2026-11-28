#!/usr/bin/env bash
# Run every SQL test against a scratch database that already has all migrations applied.
# Usage: DATABASE_URL=postgres://... bash scripts/test-db.sh
# On plain Postgres (not Supabase) first grant table access to authenticated/anon (see supabase/tests/business_rules.sql).
set -u; fail=0
for t in business_rules branch_access role_model rls_audit saas_checkout saas_platform rbac_rls.test e2e_flow stored_links; do
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "supabase/tests/$t.sql" >/tmp/dbtest.out 2>&1; then echo "PASS $t"; else echo "FAIL $t"; grep -E "ERROR|FAIL" /tmp/dbtest.out | head -3; fail=1; fi
done; exit $fail
