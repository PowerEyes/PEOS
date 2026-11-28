# Audit Execution Plan - POWEROS / POWER EYES

## Phase 1 — Environment Verification (COMPLETE)

### PHASE 1 SUMMARY
- ✅ Application URL confirmed: http://localhost:3001 (ERP), http://localhost:3003 (website)
- ✅ Environment confirmed as staging/development (local Supabase project)
- ✅ No production credentials detected
- ✅ No real customer information detected
- ✅ Environment Safety Report created: ENVIRONMENT_SAFETY_REPORT.md
- ✅ Existing data assessment: 1 organization (default), branch count unknown, user count unknown
- ⚠️ Signup/login required before proceeding with data creation
- ⚠️ Standard "Request access" flow creates unapproved staff requiring invitation or SQL approval

### Environment Safety Report Status
- Application URL: http://localhost:3001
- Environment: Local development staging (NOT production)
- Supabase project: https://lnoagnobwrptbcdeshji.supabase.co (test project)
- Safety status: ✅ Staging confirmed, ⚠️ Login required

## Phase 2 — Organization Creation

### ORG-01 through ORG-10: Create 10 Organizations
**Target**: 10 organizations with unique names, codes, contact info, settings

**Test Cases**:
- ORG-01: Organization creation with validation
- ORG-02: Organization editing (name, address, phone, email)
- ORG-03: Logo upload (valid, large, unsupported type, empty, replace, remove)
- ORG-04: Organization settings (save, refresh, persistence, validation, cancel)
- ORG-05: Organization status (active, deactivation, reactivation, restrictions)

**Synthetic Names**: Test Optical Group 01 through Test Optical Group 10

**Prerequisite**: Successful login as owner (requires signup through UI)

### ORG-01 — Organization Creation
- Create organization with unique name, code, contact info
- Verify required-field validation
- Verify duplicate organization name handling
- Verify duplicate organization code handling
- Verify invalid email validation
- Verify invalid phone validation
- Verify incomplete form validation
- Verify successful creation
- Verify organization appears in organization listing

### ORG-02 — Organization Editing
- Edit organization name, address, phone, email
- Edit business information
- Save, refresh, verify persisted data

### ORG-03 — Logo Upload
- Valid image upload
- Large image upload
- Unsupported file type
- Empty upload
- Replace logo
- Remove logo (if supported)
- Preview
- Persistence after refresh

### ORG-04 — Organization Settings
- Test all visible settings
- Verify: Save, Refresh, Settings persistence, Validation, Cancel, Default values
- Verify settings affecting other modules
- Verify organization-specific configuration

### ORG-05 — Organization Status
- Active organization
- Deactivation
- Reactivation (if supported)
- Restrictions when inactive
- Users associated with inactive organizations
- Branches associated with inactive organizations
- Existing records and historical data preservation

## Phase 3 — Branch Management

### BRANCH-01 through BRANCH-06: Create 80+ Branches (10 orgs × 8+ branches)
**Target**: 80+ branches distributed across 10 organizations

**Test Cases**:
- BRANCH-01: Create branch (valid, missing fields, duplicate name, duplicate code, invalid phone, invalid email, invalid postal code, invalid address, unauthorized creation)
- BRANCH-02: Edit branch (name, code, address, phone, email, manager, settings, tax config; verify saved data after refresh)
- BRANCH-03: Deactivate branch (confirmation dialog, active users, existing customers/orders/inventory/repairs, historical data accessibility, new transaction prevention, reactivation)
- BRANCH-04: Branch address and contact (display, editing, validation, contact details, data persistence, branch identity in invoices/documents)
- BRANCH-05: User assignment (assign to branch, multiple branches, remove assignment, assign manager, assign staff, specialist roles, unauthorized assignment, inactive user, from another organization, without assignment, manager access boundaries)
- BRANCH-06: Branch switching (switch branches, switch organizations, switch from different modules, refresh after switching, second tab, consistency, session persistence, incorrect selection, unauthorized branch, inactive branch)

**Distribution**: 
- Org 01: 8 branches
- Org 02: 9 branches  
- Org 03: 10 branches
- Remaining: distributed across remaining branch target (80 minimum)

## Phase 4 — Users and RBAC

### Test Users and Role Assignments
- Create test users through UI
- Assign roles (owner, admin, staff)
- Assign branches
- Validate access restrictions

**Role Permissions**:
- owner: everything including settings, GST toggle, discount override
- admin: everything except cannot change org settings
- staff: POS, customers, prescriptions, inventory (read), workshop; cannot override discount limit

## Phase 5 — Master Data

### Customers, Products, Suppliers, Employees
- Create and validate master data
- Test duplicate detection, search, editing, deactivation

## Phase 6 — Inventory

### Branch-Specific Stock
- Product creation, SKU generation, barcode generation
- Duplicate SKU handling
- Product images, stock opening, adjustments
- Stock receiving, transfers, counts, reconciliation
- Reserved stock, available stock, damaged stock, expired stock
- Low-stock alerts, negative-stock prevention
- Inventory valuation, branch stock visibility

## Phase 7 — Clinical Data

### Eye Examinations and Prescriptions
- Prescription creation with OD/OS sphere, cylinder, axis, add
- PD, monocular PD, prism
- Prescription type, lens recommendation, prescriber
- Examination date, expiry, status
- Valid prescription, invalid prescription, missing values
- Extreme values, expired prescription, duplicate prescription
- Prescription history, versioning, prescription selection during sales

## Phase 8 — Sales and Orders

### Complete Order Lifecycle
- Walk-in customer, existing customer, new customer
- Customer with prescription, without prescription
- Frame-only sale, lens-only sale, complete eyewear sale
- Contact lens sale, accessories sale, repair sale
- Multiple items, discount, tax, partial payment, full payment
- Credit sale, refund, cancellation

**Sales Validation**:
- Empty cart, zero quantity, negative quantity
- Invalid product, out-of-stock product, insufficient stock
- Discount limits, unauthorized discount, invalid tax
- Invalid payment, duplicate payment, payment failure
- Partial payment, excess payment

**Sales Records Verification**:
- Invoice number, branch, customer, staff member
- Product, quantity, price, discount, tax, total
- Payment, balance, status, stock impact
- Prescription association, order association

## Phase 9 — Lab Workflow

### Lab Job Creation and Status Transitions
- Lab job creation, job assignment, lens availability
- Lens ordering, receipt, verification, preparation
- Status transitions, technician priority, due date
- Delays, rejection, rework, job completion
- Order association, branch association

**Negative Tests**:
- Missing lens, incorrect lens, wrong prescription
- Wrong customer, wrong order, duplicate lab job
- Invalid status transition, unauthorized completion
- Cancelled order with active lab job, lab job with missing information
- Failed job, rework loop

## Phase 10 — Workshop

### Workshop Job Creation and Workflow
- Workshop job creation, assignment, frame preparation
- Lens fitting, assembly, repair work
- Technician workflow, parts usage, consumables
- Status transitions, job completion, rework
- Work notes, branch isolation, order association
- Customer association

**Incorrect Tests**:
- Wrong customer, frame, lens, prescription, order, technician, branch

## Phase 11 — Quality Control

### QC Job Creation and Inspection
- QC job creation, inspection checklist
- Pass, fail, rejection, rework, reinspection, approval
- Technician/QC user identification, timestamp
- Prescription verification, lens verification, frame verification
- Assembly verification, cosmetic inspection
- Customer-order verification

**Negative Tests**:
- Attempt to approve failed QC
- Attempt delivery without QC
- Attempt unauthorized QC
- Attempt to bypass required checklist
- Attempt duplicate QC
- Attempt to change approved QC

## Phase 12 — Delivery

### Delivery Workflow
- Order-ready status, customer notification
- Delivery scheduling, assignment, pickup
- Delivery confirmation, customer acknowledgement
- Delivery date, delivered-by user, outstanding payment
- Partial payment, fully paid order, warranty activation
- Customer history update

**Negative Tests**:
- Deliver order not ready, deliver with failed QC
- Deliver from wrong branch, deliver belonging to another organization
- Deliver unpaid order where payment required
- Duplicate delivery confirmation, cancel delivery, reopen delivery

## Phase 13 — Finance

### Financial Audit
- Sales revenue, payment collection (cash, card, UPI, bank, credit)
- Partial payment, refund, advance payment, outstanding balance
- Invoice, credit note, debit note, purchase, supplier payment
- Supplier credit, expense, GST, tax calculations
- Cash closing, daily reconciliation, branch financial report
- Organization-level consolidated report

**Verify**:
- No duplicate transactions, no missing financial records
- No incorrect totals, correct branch/organization
- Correct tax, correct currency, correct payment status
- Correct invoice numbering, correct refund handling
- Correct reconciliation

## Phase 14 — Appointments

### Appointment Scheduling and Management
- Appointment creation, customer selection (new/existing)
- Examination appointment, optometrist, branch, date, time, duration
- Status: confirmation, reschedule, cancellation, completed, no-show
- Reminder, branch calendar, organization calendar

**Conflict Tests**:
- Same optometrist, same time, same room (if supported)
- Inactive branch, unauthorized staff, duplicate appointment

## Phase 15 — Reports

### Branch and Organization Reports
- Sales report, revenue report, inventory report
- Stock movement, customer report, prescription report
- Repair report, order report, lab report
- Workshop report, QC report, delivery report
- Finance report, appointment report, staff report

**Verify**: Date filters, branch filters, organization filters
- Staff filters, status filters, product filters
- Export, pagination, search, sorting, totals, charts
- Empty states, large dataset performance

**Consolidated Reports**: Branch totals, organization totals, consolidated totals
- No duplicated records, no missing branches, no incorrect aggregation

## Phase 16 — Isolation

### Organization Isolation Test
- Test each organization's data isolation
- Customers, prescriptions, orders, products, inventory
- Repairs, invoices, payments, suppliers, purchase orders
- Appointments, branches, settings

**Isolation Tests**:
- Org A can see Org B customers? (should NOT)
- Org A can search Org B customers? (should NOT)
- Org A can see Org B inventory? (should NOT)
- Org A can access Org B orders? (should NOT)
- Org A can view Org B prescriptions? (should NOT)
- Org A can see Org B repairs? (should NOT)
- Org A can view Org B invoices? (should NOT)
- Org A can access Org B reports? (should NOT)
- Org A can edit Org B data? (should NOT)
- Org A can delete Org B data? (should NOT)
- Org A can access another organization's branch? (should NOT)
- Org A can use another organization's numbering sequences? (should NOT)

**Classification**: If unauthorized access appears → CRITICAL tenant isolation/security vulnerability

### Branch Isolation Test
- Within each organization, verify branch data isolation
- Branch A customer visibility vs Branch B
- Branch A inventory vs Branch B
- Branch A sales vs Branch B sales
- Branch A prescriptions vs Branch B
- Branch A repairs vs Branch B
- Branch A appointments vs Branch B
- Branch A invoices vs Branch B
- Branch A financial records vs Branch B
- Branch A reports vs Branch B

**Test**: Switching, search, filters, reports, export, global search, dashboard, notifications, customer workspace, order workspace

**Verify**: Branch-specific data is not accidentally mixed

## Phase 17 — Performance

### Large Dataset Performance
- Login time, dashboard loading time
- Organization list loading time, branch list loading time
- Customer list loading time, customer search response
- Product search response, inventory page loading time
- Sales page loading time, order loading time
- Prescription loading time, repair loading time
- Reports loading time

**Test**: Large tables, large search results, pagination, sorting, filtering
- Multiple tabs, refresh, navigation, back navigation
- Long sessions, branch switching repeatedly

**Record**: Any visible performance issues (UI freezing, infinite loading, duplicate loading, tab instability, memory-related symptoms)

## Phase 18 — Responsive and UX

### Responsive Testing
- Desktop, tablet, mobile responsiveness
- Layout defects, misaligned elements, incorrect spacing
- Inconsistent buttons, incorrect colors, missing labels
- Confusing navigation, duplicate actions, missing breadcrumbs
- Inconsistent drawers, broken modals, overlapping controls
- Text overflow, table overflow, mobile responsiveness

### UX Audit
- Every finding must have screenshot evidence
- Broken layout, misaligned elements, incorrect spacing
- Inconsistent buttons, incorrect colors, missing labels
- Confusing navigation, duplicate actions, missing breadcrumbs
- Inconsistent drawers, broken modals, overlapping controls
- Text overflow, table overflow
- Mobile/tablet/desktop responsiveness
- Missing loading indicators, missing empty states
- Missing error states, unclear confirmation dialogs
- Destructive actions without confirmation
- Inaccessible controls, keyboard navigation problems
- Form validation problems, unclear permissions
- Inconsistent statuses, incorrect icons, missing tooltips
- Missing help text, incorrect data display, poor search experience
- Slow workflows, unnecessary clicks, duplicate data entry

## Phase 19 — Final Gap Analysis

### Blockers, Defects, Missing Features
- Document all findings with severity
- Create prioritized remediation roadmap
- Group improvements: P0 (fix immediately), P1 (fix before production), P2 (important improvements), P3 (future enhancements)

---
*Audit execution plan. Ready to proceed with Phase 2 after successful login.*