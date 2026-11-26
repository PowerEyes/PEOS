## Payroll, Drive backup, bank reconciliation (2026-11-26)
- Payroll: salary structures, monthly runs, finalise, mark paid, printable payslips, "My payslips".
- Backup: nightly Google Drive backup (OAuth drive.file), manual backup, direct download, run history.
- Bank reconciliation: CSV import, auto/manual matching to non-cash cashbook entries.
- Razorpay: subscription payments are checked against the gateway's captured amount; webhook checks the quoted amount.
- Website controller: header/footer/menu links are validated against real routes and active pages.
- Removed placeholder pages (Security, Leave, Attendance, Offline sync); Integrations shows real status; remaining "Power Eyes" defaults removed.

# Changelog

All notable changes to PowerOSC are documented here.

## [Unreleased]

### Added
- `DESIGN.md` — shared design system (General Sans + JetBrains Mono, navy/gold palette)
- `CLAUDE.md` — design system reference for AI-assisted development
- `docs/API.md` — API reference for web and ERP routes
- `docs/ARCHITECTURE.md` — system architecture overview
- `IMPROVEMENT_REPORT.md` — DX + design audit findings
- `.github/workflows/ci.yml` — CI pipeline (typecheck, lint, unit tests)
- `.github/ISSUE_TEMPLATE/` — bug report and feature request templates
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template

### Changed
- Replaced Inter + Playfair Display with General Sans across both apps
- Updated `.gitignore` to ignore `.playwright-mcp/`, `.env`, `.env.local`
- Added `dev:web` and `dev:erp` scripts to root package.json

### Fixed
- Removed committed `tsconfig.tsbuildinfo` files from git tracking
- Fixed duplicate `.card` CSS class definition in `globals.css`

## [Build 6] — Finance & GST (2026-11-22)

### Added
- GST ledger (output ITC vs input ITC)
- Credit notes with GST reversal and stock return
- Invoice PDF with HSN, CGST/SGST/IGST breakdown
- Bill of Supply (GST off) vs Tax Invoice (GST on)
- Period close/lock for GST liability

## [Build 5] — Lab & Workshop (2026-11-21)

### Added
- Lab order auto-creation from lens lines
- Workshop board with flow: To buy → Ordered → Received → Edging → Fitting → QC → Ready → Delivered
- GST switch (inclusive/exclusive pricing)
- Inline customer creation in POS
- Settings: business profile, branch lifecycle, GST defaults, staff rules

## [Build 4] — POS & Sales (2026-11-20)

### Added
- POS as full-screen overlay
- Camera barcode scanning (@zxing)
- Lens index and add-ons management
- Discount approval workflow (staff limit → owner/admin)
- Payment processing with balance validation
- Quotations with conversion to orders

## [Build 3] — Inventory (2026-11-19)

### Added
- Product catalog with variants (frames, sunglasses, lenses)
- Stock tracking per branch
- Lens packages and options
- Barcode generation (jsbarcode)
- `power_eligible` flag for lens selection CTA

## [Build 2] — Prescriptions & OCR (2026-11-18)

### Added
- Prescription page with photo OCR
- A5 print layout for prescriptions
- Ctrl+K command palette
- Toast notifications
- Skeleton loading
- Count-up KPI animations
- Mobile bottom navigation
- Branch cookie persistence

## [Build 1] — Foundation & Customers (2026-11-17)

### Added
- Monorepo (Turborepo + pnpm): apps/erp, packages/ui
- Supabase: tenancy, branches, approved-staff profiles, customers
- PowerOS shell (sidebar, branch switcher, mobile drawer)
- Dashboard, Customers (Add drawer, Customer 360 modal)
- RLS policies for multi-tenant data isolation