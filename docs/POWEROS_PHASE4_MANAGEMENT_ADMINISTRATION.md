# PowerOS Phase 4 — Management & Administration UX Build

## Scope
Updated management/admin pages for Branches, Staff & HR, Attendance, Leave, Company settings, Security, Integrations, Backup, Subscription and SaaS Platform Administration.

## Changes made
- Branches: KPIs for total, active, default and missing-contact branches; existing create/detail flows retained.
- Staff: KPIs for visible staff, approved-active staff, pending approval and active branches; existing staff, branch access, permissions and assignment panels retained.
- Attendance: roster/approved/pending/temporary-cover KPIs and an explicit limitation notice. This page is a roster/assignment view, not a time clock register.
- Leave: replaced inert Apply Leave button and fake empty table with organization staff/branch metrics and explicit status that request/approval workflow is not implemented. No fake leave records are presented.
- Company: configuration-completion KPIs across profile topics; existing configuration navigation retained.
- Security: role/account status metrics and explicit capability status. Removed inert Enable 2FA/View Sessions controls; states that MFA/session controls are not implemented in this page and require identity-provider configuration/validation.
- Integrations: configuration-presence checks for Razorpay, WhatsApp, OCR and Google Analytics without displaying secrets. Status is labelled Configured/Not configured, not Connected; page explicitly warns that presence does not prove health/delivery.
- Backup: removed fabricated “Enabled / Today 3 AM / 30 days” claims and inert Export button. Displays verified application data and backup/restore status as not verified; added operator recovery checklist.
- Subscription: KPIs for entitlement status and branch/staff/customer usage; existing billing and plan flows preserved.
- Platform Admin: user/active/super-admin/audit-event KPIs added; existing administration and audit views preserved.
- Platform Dashboard: clarified MRR/ARR are price-derived estimates, not recognized revenue/payment reconciliation.

## Validation
- Source edits were made in the extracted Phase 3 source ZIP.
- Full production validation is still required: install dependencies, typecheck, build, run unit/integration tests, database-backed RBAC tests, and browser testing at desktop/tablet/mobile widths.
- No live database, secrets, or production configuration were modified.

## Production readiness caveats
- Leave request workflow remains unimplemented.
- Attendance is not a clock-in/out timekeeping system.
- Backup health/retention/restore evidence is not connected to this UI.
- Integration connectivity and message/payment delivery need dedicated health checks and test transactions.
- MFA and session revocation need identity-provider flow validation.
