# SaaS DX Implementation Plan

## Overview

This document outlines the implementation plan for SaaS-specific developer experience improvements identified in the DX audit. Each item includes integration points, file locations, and implementation steps.

---

## 1. Guided Onboarding Wizard

### What
A step-by-step wizard that new tenants go through after first login to set up their company, branches, and initial data.

### Where to Integrate
- **ERP App:** `apps/erp/src/app/(app)/onboarding/page.tsx` (already exists, needs expansion)
- **New files:**
  - `apps/erp/src/app/(app)/onboarding/wizard.tsx` (already exists)
  - `apps/erp/src/app/(app)/onboarding/steps/` — new directory for step components
  - `apps/erp/src/app/(app)/onboarding/actions.ts` — server actions for provisioning

### Implementation Steps

1. **Step 1: Company Profile**
   - Collect: company name, GSTIN, address, phone, email
   - Server action: `createTenant()` → inserts into `tenants` table
   - Auto-generate tenant slug from company name

2. **Step 2: First Branch**
   - Collect: branch name, address, phone, GST state
   - Server action: `createBranch(tenantId, branchData)` → inserts into `branches` table
   - Set as default branch

3. **Step 3: Admin Account**
   - Auto-create owner profile linked to the logged-in user
   - Server action: `assignOwnerRole(userId, tenantId, branchId)`

4. **Step 4: Initial Data**
   - Option to seed sample products, customers, or start blank
   - Server action: `seedSampleData(tenantId, branchId, template)`

5. **Step 5: Go Live**
   - Show summary, "Start using PowerOSC" button
   - Mark onboarding as complete: `updateTenant(tenantId, { onboarding_complete: true })`

### Integration with Existing Code
- The onboarding page already exists at `apps/erp/src/app/(app)/onboarding/page.tsx`
- The setup wizard exists at `apps/erp/src/app/(app)/setup/wizard.tsx`
- Consolidate these into a single flow
- Add middleware check: if `onboarding_complete === false`, redirect to `/onboarding`

### Middleware Update
```typescript
// apps/erp/src/middleware.ts
if (!session) redirect to /login
if (!tenant.onboarding_complete) redirect to /onboarding
```

---

## 2. Tenant Provisioning API

### What
An API endpoint that allows programmatic tenant creation (for SaaS signup flow, admin tools, or integrations).

### Where to Integrate
- **New file:** `apps/erp/src/app/api/provision/route.ts`
- **Or:** `apps/web/src/app/api/signup/route.ts` (for self-service signup)

### Implementation

```typescript
// apps/web/src/app/api/signup/route.ts
export async function POST(request: Request) {
  const { company_name, email, password, branch_name } = await request.json();

  // 1. Create Supabase auth user
  const { data: authUser, error: authError } = await supabase.auth.signUp({
    email, password
  });

  // 2. Create tenant
  const { data: tenant } = await supabase.from('tenants').insert({
    name: company_name,
    slug: slugify(company_name),
    plan: 'trial',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }).select().single();

  // 3. Create first branch
  const { data: branch } = await supabase.from('branches').insert({
    tenant_id: tenant.id,
    name: branch_name || 'Main Branch',
    is_default: true,
  }).select().single();

  // 4. Assign owner role
  await supabase.from('staff_profiles').insert({
    user_id: authUser.user.id,
    tenant_id: tenant.id,
    branch_id: branch.id,
    role: 'owner',
    status: 'approved',
  });

  return Response.json({ tenant_id: tenant.id, branch_id: branch.id });
}
```

### Integration Points
- Add to `docs/API.md` under "SaaS Provisioning"
- Add rate limiting (1 signup per IP per hour)
- Add email verification flow (Supabase Auth handles this)
- Add trial expiry cron job (Supabase Edge Function or external cron)

---

## 3. Trial/Demo Mode

### What
Allow prospects to try the software with sample data before committing.

### Where to Integrate
- **Web:** Add "Try Demo" button on landing page
- **ERP:** Create demo tenant with pre-seeded data
- **Database:** Add `is_demo` flag to tenants table

### Implementation

1. **Demo Tenant Creation (server-side)**
   - Create a tenant with `is_demo = true` and `demo_expires_at = now + 24h`
   - Seed with sample products, customers, sales, prescriptions
   - Use a cron job to clean up expired demo tenants

2. **Demo Login**
   - Public demo credentials: `demo@powerosc.com` / `demo123`
   - Auto-reset demo data every 24 hours
   - Show "Demo Mode" banner in ERP shell

3. **Conversion Flow**
   - "Upgrade to Full Account" button in demo mode
   - Migrates demo data to a real tenant on signup

### Files to Create/Modify
- `apps/web/src/app/api/demo/route.ts` — create demo session
- `apps/erp/src/components/DemoBanner.tsx` — demo mode indicator
- `supabase/migrations/` — add `is_demo`, `demo_expires_at` to tenants table
- `scripts/seed_demo.sql` — demo seed data

---

## 4. Tenant Isolation Tests

### What
Automated tests that verify RLS policies prevent cross-tenant data access.

### Where to Integrate
- **New directory:** `supabase/tests/tenant_isolation/`
- **CI:** Add to `.github/workflows/ci.yml`

### Test Structure

```sql
-- supabase/tests/tenant_isolation/01_cross_tenant_read.sql
-- Test: Tenant A cannot read Tenant B's customers

BEGIN;
-- Set up two tenants
SELECT create_test_tenant('tenant_a');
SELECT create_test_tenant('tenant_b');

-- Insert customer for tenant B
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user_b", "tenant_id": "tenant_b"}';
INSERT INTO customers (tenant_id, name) VALUES ('tenant_b', 'Secret Customer');

-- Switch to tenant A user
SET request.jwt.claims = '{"sub": "user_a", "tenant_id": "tenant_a"}';

-- Attempt to read tenant B's customer (should return 0 rows)
SELECT count(*) FROM customers WHERE tenant_id = 'tenant_b';
-- Expected: 0

ROLLBACK;
```

### CI Integration
```yaml
# .github/workflows/ci.yml
  rls-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
    steps:
      - uses: actions/checkout@v4
      - run: psql -f supabase/tests/tenant_isolation/*.sql
```

---

## 5. Data Export

### What
Allow tenants to export their data (customers, products, sales, prescriptions) as CSV/JSON.

### Where to Integrate
- **ERP:** Add "Export Data" section in Settings
- **New files:**
  - `apps/erp/src/app/(app)/settings/export/page.tsx`
  - `apps/erp/src/app/(app)/settings/export/actions.ts`
  - `apps/erp/src/app/api/export/[type]/route.ts`

### Implementation

```typescript
// apps/erp/src/app/api/export/[type]/route.ts
export async function GET(request: Request, { params }: { params: { type: string } }) {
  const { tenant_id } = await getAuthContext();
  const type = params.type; // 'customers' | 'products' | 'sales' | 'prescriptions'

  const { data } = await supabase
    .from(type)
    .select('*')
    .eq('tenant_id', tenant_id);

  const csv = convertToCSV(data);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}-export.csv"`,
    },
  });
}
```

### Export Types
| Type | Tables | Format |
|------|--------|--------|
| customers | customers, vision_profiles | CSV |
| products | products, product_variants | CSV |
| sales | sales, sale_lines, payments | CSV + JSON |
| prescriptions | prescriptions | CSV |
| full | All tables | JSON (zip) |

---

## 6. Integration API

### What
REST API for third-party integrations (accounting software, payment gateways, e-commerce platforms).

### Where to Integrate
- **New directory:** `apps/erp/src/app/api/v1/`
- **Auth:** API key based (stored in `api_keys` table per tenant)

### Endpoints

```
GET  /api/v1/customers          — List customers (paginated)
GET  /api/v1/customers/:id      — Get customer details
POST /api/v1/customers          — Create customer
GET  /api/v1/products           — List products
GET  /api/v1/sales              — List sales (date range)
GET  /api/v1/sales/:id          — Get sale details
POST /api/v1/sales              — Create sale (POS integration)
GET  /api/v1/inventory/stock    — Stock levels per branch
POST /api/v1/webhooks/payment   — Payment gateway callback
```

### Implementation Plan

1. **API Key Management**
   - Add `api_keys` table: `id, tenant_id, key_hash, name, scopes, created_at, expires_at`
   - UI in ERP Settings → Integrations → API Keys

2. **Middleware**
   - `apps/erp/src/middleware.ts` — check `Authorization: Bearer <api_key>` header
   - Validate key, check scopes, set tenant context

3. **Rate Limiting**
   - 1000 requests/hour per API key
   - Use Supabase Edge Function or in-memory rate limiter

4. **Documentation**
   - Add to `docs/API.md` under "Integration API (v1)"
   - Add OpenAPI spec in `docs/openapi.yaml`

---

## 7. Health Check Endpoint

### What
A simple endpoint that returns service health for monitoring tools.

### Where to Integrate
- `apps/web/src/app/api/health/route.ts`
- `apps/erp/src/app/api/health/route.ts`

### Implementation

```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
  };

  const healthy = Object.values(checks).every(c => c === 'ok');

  return Response.json(
    { status: healthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}

async function checkDatabase() {
  try {
    const { error } = await supabase.from('tenants').select('id').limit(1);
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}
```

---

## 8. Structured Logging

### What
Replace `console.log/error` with structured JSON logging that can be ingested by log aggregators.

### Where to Integrate
- **New file:** `packages/ui/src/logger.ts` (shared)
- **Modify:** All server actions and API routes to use the logger

### Implementation

```typescript
// packages/ui/src/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  tenant_id?: string;
  user_id?: string;
  request_id?: string;
  [key: string]: unknown;
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (process.env.NODE_ENV === 'production') {
    // Output JSON for log aggregator ingestion
    console.log(JSON.stringify(entry));
  } else {
    // Pretty print for development
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
};
```

### Integration
- Replace all `console.error` calls in server actions with `logger.error`
- Add request ID middleware for tracing
- In production, pipe to Vercel Logs / Datadog / Logtail

---

## 9. Monitoring & Alerting

### What
Uptime monitoring, error rate alerts, and performance tracking.

### Where to Integrate
- **External:** UptimeRobot or Better Uptime (free tier) for `/api/health`
- **Error tracking:** Sentry (free tier: 5K errors/month)
- **Performance:** Vercel Analytics (built-in) or Web Vitals

### Implementation Steps

1. **Sentry Setup**
   ```bash
   pnpm add @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```
   - Configure in `apps/web/sentry.client.config.ts` and `apps/erp/sentry.client.config.ts`
   - Add DSN to `.env.example`

2. **Uptime Monitoring**
   - Add `/api/health` to UptimeRobot (free)
   - Alert via email/Slack when health check fails

3. **Error Rate Alerts**
   - Sentry alert: >10 errors in 5 minutes → Slack notification
   - Sentry alert: new error type → email notification

---

## 10. Backup & Restore Documentation

### What
Document how to back up and restore tenant data.

### Where to Integrate
- **New file:** `docs/BACKUP_RESTORE.md`

### Content

```markdown
# Backup & Restore

## Automated Backups (Supabase)
Supabase provides daily automated backups for paid plans.
- Retention: 7 days (Pro), 30 days (Team)
- Restore: Supabase Dashboard → Database → Backups → Restore

## Manual Backup
```bash
# Export entire database
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql

# Export specific tenant
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --table=customers --table=products --table=sales \
  -f tenant_backup.sql
```

## Per-Tenant Export
Use the Data Export feature in ERP Settings → Export Data.
Exports: customers, products, sales, prescriptions as CSV/JSON.

## Restore Procedure
1. Stop the application
2. Restore from backup: `psql -h ... -f backup.sql`
3. Verify data integrity: `pnpm verify:migrations`
4. Restart the application
5. Notify affected tenants

## Disaster Recovery
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 24 hours (daily backups)
- For critical data: enable point-in-time recovery (Supabase Pro)
```

---

## Implementation Priority

### Phase 1 (Week 1) — Critical for Production
1. Health check endpoints (both apps)
2. Sentry error tracking (both apps)
3. Structured logging (shared package)
4. Backup/restore documentation

### Phase 2 (Week 2) — SaaS Onboarding
5. Guided onboarding wizard (expand existing)
6. Tenant provisioning API (signup endpoint)
7. Trial/demo mode

### Phase 3 (Week 3) — Multi-Tenancy Safety
8. Tenant isolation tests (RLS verification)
9. Data export feature
10. Monitoring & alerting setup

### Phase 4 (Week 4) — Ecosystem
11. Integration API (v1 endpoints)
12. API key management
13. OpenAPI spec

---

## File Creation Summary

| File | Purpose | Priority |
|------|---------|----------|
| `apps/web/src/app/api/health/route.ts` | Health check | P0 |
| `apps/erp/src/app/api/health/route.ts` | Health check | P0 |
| `apps/web/sentry.client.config.ts` | Sentry web | P0 |
| `apps/erp/sentry.client.config.ts` | Sentry ERP | P0 |
| `packages/ui/src/logger.ts` | Structured logging | P0 |
| `docs/BACKUP_RESTORE.md` | Backup docs | P0 |
| `apps/erp/src/app/(app)/onboarding/` | Onboarding wizard | P1 |
| `apps/web/src/app/api/signup/route.ts` | Tenant provisioning | P1 |
| `apps/erp/src/app/api/export/[type]/route.ts` | Data export | P2 |
| `apps/erp/src/app/api/v1/` | Integration API | P3 |
| `supabase/tests/tenant_isolation/` | RLS tests | P2 |
| `docs/openapi.yaml` | OpenAPI spec | P3 |

---

## Estimated Effort

| Phase | Items | Effort (human) | Effort (with AI) |
|-------|-------|----------------|-------------------|
| Phase 1 | 4 items | 2-3 days | 4-6 hours |
| Phase 2 | 3 items | 3-5 days | 1-2 days |
| Phase 3 | 3 items | 2-3 days | 1 day |
| Phase 4 | 3 items | 3-5 days | 1-2 days |
| **Total** | **13 items** | **10-16 days** | **3-6 days** |