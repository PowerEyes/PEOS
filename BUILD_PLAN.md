# PowerOS SaaS Platform - Complete Build Plan

## Overview

Three separate applications running on different ports, sharing a single Supabase project:

| App | Port | Purpose |
|-----|------|---------|
| **PowerOS ERP** | `3001` | Tenant application - optical store operations |
| **SaaS Platform** | `3002` | Super-admin control plane |
| **SaaS Website** | `3003` | Marketing, sign-up, subscription checkout |

---

## Directory Structure Created

```
/PowerOSC/
├── apps/
│   ├── erp/                          # EXISTING - ERP tenant (port 3001)
│   ├── saas-platform/                # NEW - Platform control plane (port 3002)
│   └── saas-website/                 # NEW - Customer acquisition site (port 3003)
├── supabase/migrations/platform/
│   ├── 0001_platform_schema.sql      # Platform tables (platform_users, staff_invitations, organisations, etc.)
│   └── 0002_erp_org_creation_guard.sql # ERP org creation + payment methods
├── packages/shared/lib/
│   ├── types/index.ts                 # Shared TypeScript types
│   └── utils/index.ts                 # Shared utility functions
└── services/email/templates/          # Email templates (empty - to be filled)
```

---

## Files Created

### 1. Platform Database Migrations

**`supabase/migrations/platform/0001_platform_schema.sql`**
- `platform_users` table - Super admins for the SaaS platform
- `platform_invitations` table - Email-based invitation flow
- `organizations` table - SaaS tenants (organisations)
- `organization_members` table - Links users to organisations
- `subscription_plans` table - Starter/Growth/Enterprise plans
- `organization_subscriptions` table - Subscription tracking
- `org_settings` table - Organisation-specific settings
- `platform_audit_log` table - Audit trail for platform actions

**`supabase/migrations/platform/0002_erp_org_creation_guard.sql`**
- Modifies `create_organisation` RPC to allow org creation via platform admin
- Creates `payment_methods` table (cash, card, upi, bank_transfer, cheque, wallet)
- Creates `payments` table extension
- Creates `organisation_subscriptions` table
- Inserts default payment methods for Nish Optics

### 2. Shared Package (`packages/shared/`)

**`packages/shared/lib/types/index.ts`**
- TypeScript interfaces for: PlatformUser, PlatformInvitation, Organisation, OrganizationMember, SubscriptionPlan, OrganizationSubscription, OrgSetting, PlatformAuditLog, Customer, Product, Sale, Prescription
- Helper types: PaginatedResponse, ApiResponse
- RoleKey, PlatformRole, OrgStatus, PlanTier, PermissionKey, ProductKind, Gender types

**`packages/shared/lib/utils/index.ts`**
- Validation functions: isValidEmail, isValidPhone, isValidGSTIN, isValidPAN
- Formatting: formatINR, formatDate, formatDateTime, formatPhone
- Helpers: slugify, generateBranchCode, calculateAge, getRoleLabel, getPlatformRoleLabel, getOrgStatusLabel, getPlanTierLabel
- Validation: isExpired, isExpiringSoon

### 3. SaaS Website (`apps/saas-website/` - port 3003)

**Configuration Files:**
- `package.json` - Next.js 14, Supabase, Razorpay dependencies
- `next.config.js` - Next.js config
- `tailwind.config.js` - Tailwind with navy/gold color system
- `postcss.config.js` - PostCSS with Tailwind
- `tsconfig.json` - TypeScript config

**Pages:**
- `app/(website)/page.tsx` - Landing page with hero, features, pricing preview
- `app/(website)/auth/signup/page.tsx` - Customer sign-up form
- `app/(website)/auth/login/page.tsx` - Customer login form
- `app/(website)/auth/verify-email/page.tsx` - Email verification
- `app/(website)/subscribe/page.tsx` - Subscription checkout with 3 plans
- `app/(website)/onboarding/page.tsx` - 7-step business onboarding wizard:
  1. Business Profile
  2. Tax & Registration
  3. Branches
  4. Team & Roles
  5. Catalogue (products)
  6. Settings (business config)
  7. Website Setup (store contact)

**API Routes:**
- `app/(website)/api/auth/signup/route.ts` - User signup
- `app/(website)/api/auth/login/route.ts` - Customer login
- `app/(website)/api/auth/verify-email/route.ts` - Email verification
- `app/(website)/api/subscribe/route.ts` - Subscription creation

### 4. SaaS Platform (`apps/saas-platform/` - port 3002)

**Configuration:**
- `package.json` - Next.js app for platform
- `next.config.js` - Next.js config
- `tailwind.config.js` - Tailwind config
- `postcss.config.js` - PostCSS config

**Pages:**
- `app/(platform)/layout.tsx` - Platform layout with sidebar navigation
- `app/(platform)/page.tsx` - Platform dashboard with stats cards and org list
- `app/(platform)/organisations/page.tsx` - Organisations list with filtering
- `app/(platform)/admin/invitations/page.tsx` - Staff invitation management
- `app/(platform)/login/page.tsx` - Platform admin login

**API Routes:**
- `app/(platform)/api/auth/login/route.ts` - Platform admin login

### 5. PowerOS ERP Modifications (`apps/erp/` - port 3001)

**`apps/erp/src/app/(app)/settings/section-payments.tsx`**
- Payment methods configuration section
- Lists payment methods (cash, card, upi, bank_transfer, etc.)
- Enable/disable toggle per method

---

## Phase 8: Remaining Implementation Steps

### 1. Database Migration Execution
Run the platform migrations on the Supabase project:
```sql
-- Run in Supabase SQL Editor:
-- 1. supabase/migrations/platform/0001_platform_schema.sql
-- 2. supabase/migrations/platform/0002_erp_org_creation_guard.sql
```

### 2. Environment Variables

**SaaS Website (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://lnoagnobwrptbcdeshji.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
NEXT_PUBLIC_ERP_URL=http://localhost:3001
```

**SaaS Platform (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://lnoagnobwrptbcdeshji.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

**PowerOS ERP (.env.local)** - Already configured

### 3. Install Dependencies
```bash
cd apps/saas-website && pnpm install
cd apps/saas-platform && pnpm install
cd apps/erp && pnpm install
```

### 4. Run Applications
```bash
# Terminal 1 - ERP (existing)
cd apps/erp && pnpm dev -p 3001

# Terminal 2 - SaaS Platform
cd apps/saas-platform && pnpm dev -p 3002

# Terminal 3 - SaaS Website
cd apps/saas-website && pnpm dev -p 3003
```

### 5. ERP Settings Integration
Add the PaymentMethodsSection to `/app/(app)/settings/view.tsx` SECTIONS array:
```typescript
{
  key: "payments",
  label: "Payments",
  icon: CreditCard,
  desc: "Payment methods configuration",
},
```

### 6. Onboarding Wizard Integration
Connect the 7-step onboarding wizard to create organisations via the platform API:
1. Submit form data to `/api/onboarding/complete`
2. Server creates organisation in Supabase
3. Creates default branches, staff, products
4. Redirects user to ERP dashboard

### 7. Payment Integration (Razorpay)
Configure Razorpay keys in both SaaS Website and ERP:
```
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
```
Configure webhook endpoints for payment confirmation.

### 8. Email Service
Configure email service (Resend, SendGrid, or Supabase Auth emails) for:
- Email verification
- Password reset
- Platform admin invitations
- Subscription receipts

---

## Testing Checklist

### Organisational Isolation
- [ ] Nish Optics users cannot see City Eye Centre data
- [ ] RLS policies block cross-org access
- [ ] Branch-scoped data is isolated

### Payment Methods
- [ ] Cash, Card, UPI, Bank Transfer configurable
- [ ] Payment methods stored per organisation
- [ ] Payment methods appear in POS

### Subscription Flow
- [ ] User signs up on website
- [ ] Email verification sent
- [ ] Organisation created with trial plan
- [ ] User redirected to ERP dashboard
- [ ] Subscription status tracked

### Role-Based Access
- [ ] Owner has full access
- [ ] Admin has most access (no org settings)
- [ ] Staff has limited access
- [ ] Specialist roles (optometrist, cashier, etc.) have role-specific access

### Platform Admin
- [ ] Platform admin can view all organisations
- [ ] Platform admin can invite staff
- [ ] Platform admin can suspend/reactivate orgs
- [ ] Platform admin can view billing

---

## Current Status

| Component | Status |
|-----------|--------|
| Nish Optics ERP (3001) | ✅ Running with test data |
| 10 role-based test accounts | ✅ Created |
| 30 suppliers, 43 products, 600 customers | ✅ Created |
| 12 test orders across lifecycle | ✅ Created |
| SaaS Website (3003) | 📝 Files created, needs pnpm install |
| SaaS Platform (3002) | 📝 Files created, needs pnpm install |
| Platform database migrations | ✅ Created |
| Shared package | ✅ Created |
| Organisation creation fix | ✅ Migration created |
| Payment methods config | ✅ Created |

---

## Next Immediate Action

1. Run database migrations on Supabase
2. Install dependencies for saas-website and saas-platform
3. Start all three apps on their respective ports
4. Test organisation creation via SaaS Website
5. Test platform admin dashboard
6. Test ERP with new organisation