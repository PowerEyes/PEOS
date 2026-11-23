# PowerOS — Complete Setup Guide

## Prerequisites
- Node.js 20+ and pnpm 9+ installed (`npm i -g pnpm`)
- A free [Supabase](https://supabase.com) account

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**
2. Choose a name (e.g. `poweros`), set a strong DB password, pick the closest region (Singapore or Mumbai for India)
3. Wait ~2 minutes for provisioning
4. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (long JWT starting with `eyJ…`)

---

## Step 2 — Configure auth

In the Supabase dashboard:

1. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3001`
   - Redirect URLs: add `http://localhost:3001/**` and your production domain later
2. **Authentication → Providers → Email** — enable it (on by default)
3. (Optional) Turn off **Email Confirm** during development so you can log in immediately:
   **Authentication → Email Templates → Confirm signup** — disable confirmation requirement
   in **Auth Settings → Email → Confirm email = OFF**

---

## Step 3 — Run migrations (in order, one at a time)

Go to **Supabase → SQL Editor → New query**. Paste and run each file in this exact order:

```
1.  supabase/migrations/0001_foundation.sql
2.  supabase/migrations/0002_prescriptions.sql
3.  supabase/migrations/0003_inventory.sql
4.  supabase/migrations/0004_sales.sql
5.  supabase/migrations/0005_lab_gst.sql
6.  supabase/migrations/0006_finance_gst.sql
7.  supabase/migrations/0007_fixes.sql        ← new in the fixes build
```

If any migration fails, check the error message and fix before continuing.

---

## Step 4 — Run seed files

Still in the SQL Editor, run in this order:

```
1.  supabase/seed/seed.sql                    ← creates org + branches
2.  supabase/seed/seed_branches.sql           ← letterhead (EDIT YOUR ADDRESS FIRST)
3.  supabase/seed/seed_inventory.sql          ← brands + one lens package
4.  supabase/seed/seed_sales.sql              ← org settings (GST, discounts)
5.  supabase/seed/seed_lab.sql                ← lab lead days
6.  supabase/seed/seed_finance.sql            ← GSTIN, HSN defaults
```

**Before running `seed_branches.sql`**, open it and fill in your real store address,
phone numbers, email and UDYAM number for both branches.

**Before running `seed_finance.sql`**, open it and replace `33AAAAA0000A1Z5` with your
actual GSTIN.

---

## Step 5 — Set environment variables

```bash
cp apps/erp/.env.example apps/erp/.env.local
```

Open `apps/erp/.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Internal self-hosted OCR. Provision/start it using services/ocr/README.md.
OCR_SERVICE_URL=http://localhost:8000
OCR_SERVICE_TOKEN=replace-with-the-same-secret-used-by-the-OCR-service

# ERP integration status bridge (use one strong random token in both apps)
NEXT_PUBLIC_WEB_URL=http://localhost:3000
INTEGRATION_HEALTH_TOKEN=replace-with-a-different-strong-random-secret
```

For the storefront, copy `apps/web/.env.example` to `apps/web/.env.local` and set Supabase URL/key, `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN`, the same `INTEGRATION_HEALTH_TOKEN`, and server-only `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` if online payments are enabled. Do not set a `NEXT_PUBLIC_` Razorpay key. In production, put these values in the deployment secret manager and point both apps at the private OCR hostname; restart/redeploy after changing environment values.

Apply `supabase/migrations/20261129000000_settings_configuration.sql` after the existing schema migrations. It adds the organisation/branch settings columns, safe default pickup controls, settings audit triggers, and seeds defaults only where no setting exists.

---

## Step 6 — Install and run

```bash
pnpm install          # installs all workspaces
pnpm dev              # runs erp on http://localhost:3001
```

---

## Step 7 — Create and approve the first owner

1. Open http://localhost:3001 — you will see the login screen
2. Click **"New staff? Request access"** and sign up with your email and a password
3. Go to Supabase SQL Editor and run (replace the email):

```sql
UPDATE profiles
SET
  org_id    = '00000000-0000-0000-0000-000000000001',
  role_key  = 'owner',
  is_approved = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

4. Refresh the browser — you are now logged in as Owner and can see all of PowerOS

---

## Step 8 — Add more staff

Each staff member signs up at `/login → "Request access"`. You then approve them and assign their role:

```sql
-- List pending approvals
SELECT u.email, p.id, p.full_name, p.is_approved
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_approved = false;

-- Approve a staff member as 'staff' (or 'admin')
UPDATE profiles
SET org_id = '00000000-0000-0000-0000-000000000001',
    role_key = 'staff',      -- 'owner' | 'admin' | 'staff'
    is_approved = true
WHERE id = '<profile-id-from-above>';
```

Role permissions:
- **owner** — everything including settings, GST toggle, discount override
- **admin** — everything except cannot change org settings
- **staff** — POS, customers, prescriptions, inventory (read), workshop; cannot override discount limit

## Guided setup

Owners and admins can continue setup at `/setup`. The wizard links to the existing
business, tax, catalogue import, staff, website contact and sales settings forms,
and stores its current step under the organisation's settings. Downloaded sample
catalogue rows are templates only; review SKUs, prices, tax and costs before
importing them into a live catalogue.

## End-to-end tests

The Playwright flows that create appointments, sales or stock require a disposable
Supabase test project. Never point them at the production database. Configure
`E2E_DATABASE_URL`, `ERP_EMAIL`, `ERP_PASSWORD`, and (if needed) `ERP_URL` for an
isolated test account, then explicitly opt into mutation with
`RUN_MUTATING_E2E=1`. Without these values the database-backed test and login setup
are skipped. Run the appointment flow with:

```bash
pnpm exec playwright test --project=erp 06-appointments.erp.spec.ts
```

The E2E account must be allowed to book at the seeded branch. The appointment
test deletes its marked appointment and examination after the run; use a
disposable database regardless.

---

## Step 9 — Storage buckets (auto-created by migrations)

Two buckets are created automatically:
- `prescriptions` — private, stores uploaded prescription photos
- `product-images` — public, stores product images

Verify in Supabase → Storage. If they are missing (some Supabase plans need manual creation):

1. **Storage → New bucket** → name: `prescriptions`, Public: **OFF**
2. **Storage → New bucket** → name: `product-images`, Public: **ON**

Then re-run the storage policy section from `0002_prescriptions.sql` and `0003_inventory.sql`.

---

## Step 10 — Production deployment (Vercel)

1. Push your repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Set **Root directory** to `apps/erp`
4. Add environment variables (same as `.env.local`)
5. Set **Site URL** in Supabase → Auth → URL Configuration to your Vercel domain
6. Add the Vercel domain to **Redirect URLs** in Supabase Auth

---

## Useful SQL queries for day-to-day admin

```sql
-- See all customers
SELECT customer_code, vision_id, full_name, phone, created_at FROM customers ORDER BY created_at DESC LIMIT 20;

-- Today's sales
SELECT code, grand_total, payment_status, status FROM sales
WHERE kind = 'order' AND created_at::date = CURRENT_DATE ORDER BY created_at DESC;

-- Low stock alerts
SELECT p.model, b.name as brand, s.qty, s.reorder_level, br.name as branch
FROM stock s JOIN products p ON p.id = s.product_id LEFT JOIN brands b ON b.id = p.brand_id JOIN branches br ON br.id = s.branch_id
WHERE s.qty <= s.reorder_level AND s.reorder_level > 0;

-- Outstanding receivables
SELECT c.full_name, s.code, s.grand_total, s.paid_total, s.grand_total - s.paid_total as balance
FROM sales s JOIN customers c ON c.id = s.customer_id
WHERE s.kind = 'order' AND s.payment_status != 'paid' AND s.status != 'cancelled'
ORDER BY s.created_at DESC;

-- GST liability for current month
SELECT
  SUM(cgst_total) as output_cgst, SUM(sgst_total) as output_sgst, SUM(igst_total) as output_igst,
  SUM(cgst_total + sgst_total + igst_total) as total_output_gst
FROM sales
WHERE kind = 'order' AND status != 'cancelled'
  AND date_trunc('month', created_at) = date_trunc('month', NOW());
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| White screen on login | Check `.env.local` has the correct Supabase URL and anon key |
| "Waiting for approval" after login | Run the approve SQL in Step 7 |
| OCR says "not configured" | Set `OCR_SERVICE_URL` and `OCR_SERVICE_TOKEN`; make sure the private PaddleOCR service is running |
| Images not showing | Check the `product-images` bucket exists and is public in Supabase |
| "Only approved staff can create sales" | Your `current_org()` returned null — run the approve SQL |
| Camera scan not working | Camera requires HTTPS; use localhost (which counts) or deploy to Vercel |
| GST not splitting into CGST/SGST | Make sure the product has a `tax_pct > 0` and GST is ON in Settings |
