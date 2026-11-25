# PowerOS - Build 1: Foundation + Customers

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_foundation.sql`, then `supabase/seed/seed.sql`.
2. Copy `apps/erp/.env.example` to `apps/erp/.env.local` and add your Supabase URL + anon key.
3. `pnpm install` then `pnpm dev` and open http://localhost:3001
4. Request access on the login screen, then run the commented "approve yourself as owner" SQL at the bottom of seed.sql with your email.

## Included
- Monorepo (Turborepo + pnpm): apps/erp, packages/ui (Drawer, Modal, Pill)
- Supabase: tenancy, branches, approved-staff profiles, customers with permanent Customer ID + Vision ID, audit log, RLS
- PowerOS shell (sidebar, branch switcher, mobile drawer), Dashboard, Customers (Add drawer, Customer 360 modal)

Not yet built (greyed in the sidebar): prescriptions/OCR, inventory, POS, lab, repairs, website, portal.

## Build 2 - Prescriptions + OCR (+ advanced UX)
1. Run `supabase/migrations/0002_prescriptions.sql`, then `supabase/seed/seed_branches.sql` (edit letterhead details first).
2. Configure the self-hosted OCR service; see [`services/ocr/README.md`](services/ocr/README.md). Set `OCR_SERVICE_URL` and `OCR_SERVICE_TOKEN` in `apps/erp/.env.local`. No hosted OCR account or token is used.
3. `pnpm install` (new package: business-rules), then `pnpm dev`.
New: Prescriptions page, photo OCR with confirm step, A5 print (/print/rx/[id]), Ctrl+K command palette, toasts, skeleton loading, count-up KPIs, mobile bottom nav, branch saved in a cookie.

## Build 3 - Inventory
1. Run `supabase/migrations/0003_inventory.sql`, then `supabase/seed/seed_inventory.sql` (brands + one lens package; edit freely).
2. `pnpm install` (adds jsbarcode), `pnpm dev`, open /inventory.
Rule: `power_eligible` on a frame/sunglass => "Choose Lens", otherwise "Add to Bag" (`ctaFor` in packages/business-rules). The website reads only the `public_catalog` view.

## Build 4 - POS, quotations, orders (+ camera scanning, lens options)
1. Run `supabase/migrations/0004_sales.sql`, then `supabase/seed/seed_sales.sql`.
2. `pnpm install` (adds @zxing), `pnpm dev`. Camera scanning needs HTTPS (works on localhost and Vercel).
3. /sales = Orders + Quotations. "New sale" opens the POS as a full-screen overlay. Lens index and add-ons are managed in Inventory > Lens options.
Rules enforced in the database (`place_sale`): prices are read from the DB, lens orders need a prescription (saved as a snapshot), stock is deducted per branch, discounts above the staff limit (org_settings) need an owner/admin, payments cannot exceed the balance.

## Build 5 - Lab orders + Workshop, GST switch, inline customer
1. Run `supabase/migrations/0005_lab_gst.sql`, then `supabase/seed/seed_lab.sql`. (No new npm packages.)
2. Owners/admins can manage the database-backed business profile, branch lifecycle and pickup defaults, GST/invoice defaults, staff discount/quotation rules, integrations, templates and settings audit history at `/settings`.
3. Placing an order with lenses auto-creates one lab order per lens line, carrying the customer's power. /workshop = board + buying list.
Flow: To buy > Ordered > Received > Edging > Fitting > QC > Ready, then Delivered from POS & Orders. The order status follows its lab orders.

## Build 6 - Finance & GST
1. Run `supabase/migrations/0006_finance_gst.sql` then `supabase/seed/seed_finance.sql`.
2. No new npm packages. `pnpm dev` and open /finance.
GST rules:
- Product-level: add HSN code and price mode (inclusive/exclusive) in Inventory product drawer Pricing tab.
- Selling prices stay as entered; taxable value is computed (inclusive: price ÷ 1.tax%, exclusive: price × tax%).
- Same-state → CGST + SGST (half each). Inter-state toggle in POS header → IGST.
- Rate is snapshot into sale_lines at time of sale. Changing the product rate never alters old invoices.
- GST off → Bill of Supply. GST on → Tax Invoice with GSTIN (set in Settings drawer).
- Returns: /finance Credit Notes tab or "Issue credit note" link in POS & Orders detail. Creates CN-XXXX with proper GST reversal and stock return.
- GST Ledger: output (from sales) vs input ITC (from purchase invoices). Close period to lock and record net liability.
- Invoices now show: HSN per line, taxable value, CGST %, CGST ₹, SGST %/₹ or IGST %/₹, grand total.


## Commercial production release documents

- `docs/POWEROS_COMMERCIAL_PRODUCTION_AUDIT.md` — current evidence-based Go/No-Go assessment.
- `docs/POWEROS_DEPLOYMENT_RUNBOOK.md` — staging, migration, environment, payment and recovery gates.
- `docs/POWEROS_PILOT_ACCEPTANCE_CHECKLIST.md` — real-shop pilot acceptance checklist.
- `docs/SECURITY_PENTEST_CHECKLIST.md` — tenant isolation, RLS, platform and security sign-off.

Do not use the historical `docs/FINAL_PRODUCTION_READY_REPORT.md` as release approval; it is marked superseded.

## UX Upgrade Reports

- [Phase 5 — Website & Customer Portal Experience Upgrade](docs/POWEROS_PHASE5_WEBSITE_CUSTOMER_PORTAL.md)
