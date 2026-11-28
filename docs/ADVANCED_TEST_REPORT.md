# PowerOS — Advanced Pilot Test & Gap Report

**Date:** 2026-11-24
**Scope:** all 203 scenarios in lists A–L (`docs/PILOT_TEST_ROUND2.md`), the recoverable advanced optical scenarios, and the technical/operational audit checklist.
**Environment:** ERP `apps/erp` (localhost:3001), website `apps/web` (localhost:3000), Supabase project `lnoagnobwrptbcdeshji`.
**Method:** static source/schema audit (writers, RLS policies, triggers, RPCs, built artifacts) plus **read-only** queries against the live dev database via the service-role REST API. No test records were created, edited or deleted.
**Severity:** Critical = money / prescription / stock / access / data loss or production outage · High = workflow blocked or material control missing · Medium = workaround exists · Low = cosmetic.
**Status:** PASS = implemented and evidenced · PARTIAL = some of the expected control exists · FAIL = expected control absent · BLOCKED = cannot be executed without writing data / external dependency · N/A = needs an external authority.

> **Test-safety note:** concurrency, payment-recovery, refund, cancellation, offline-POS, migration and restore tests need to create/change records or an external gateway. They are reported as BLOCKED with ready-to-run plans in §9. Do not run them against the live dev database.

---

## 1. Executive summary

| Metric | Result |
|---|---|
| Scenarios audited | **203** across 12 modules |
| PASS | **43** (21%) |
| PARTIAL | **56** (28%) |
| FAIL | **79** (39%) |
| BLOCKED | **24** (12%) |
| N/A (accountant/authority) | **1** |
| Critical findings | **7** — deactivated staff retained access, refunds open to any staff, idempotency broken, GST/lab data discarded by `place_sale`, expired Rx accepted, migration version collision, live service-role secrets in workspace |
| Build / typecheck | Website + ERP TypeScript pass; `verify:migrations` validates **76 unique versions** |
| Production readiness | **NOT READY** — 20 critical/high blockers from `docs/PRODUCTION_READINESS_ASSESSMENT.md` remain open |

**Most urgent actions:** (1) merge the duplicate customer `9000000001`, then apply the migration set in staging; (2) rotate the service-role keys found in `.env.local`; (3) add the Rx approval/reapproval UI before enabling the approval trigger; (4) wire the existing lens recommendation/eligibility engine into the web configurator; (5) run the BLOCKED concurrency and payment-recovery plans in an isolated database.

---

## 2. Production readiness — build verification

| Check | Before | After | Evidence |
|---|---|---|---|
| Website production build | **FAIL** | **PASS** | `/my/login` was resolved by both `page.tsx` and `route.ts`; stale page deleted. 58 static pages generated. |
| ERP production build | not reached | **PASS** | Turbo aborted before ERP; direct `tsc --noEmit` now passes for both workspaces. |
| Workspace dependency graph | **FAIL** | **PASS** | `packages/ui/src/rx-input.tsx` imports `@poweros/business-rules`; symlink recreated by `pnpm install --frozen-lockfile`. |
| Migration versioning | **FAIL** | **PASS** | Two files claimed `0041` and two claimed `0042`; new files renamed to `20261217000010/20/30`. `pnpm verify:migrations` → `Validated 76 unique migration versions.` |
| Turbo runner | - | **ENV ISSUE** | `pnpm build` emitted `spawn UNKNOWN` from turbo on this Windows shell after the fixes; per-workspace `tsc --noEmit` is clean. Re-run `pnpm build` in CI/Linux before release. |

---

## 3. Read-only database audit (live dev data)

| Check | Result | Severity | Detail |
|---|---|---|---|
| Duplicate customer mobile | **FAIL** | High | `CUS-0006` / `CUS-0007` both `9000000001`. No plain unique index is enabled. |
| Phone normalisation | **FAIL → fixed in code** | Medium | `createCustomer()` validated digits-only but inserted the raw typed value; now stores digits only. |
| Branch attribution | **FAIL → fixed in code** | Medium | 4 of 7 customers had `branch_id = null`; new customers now inherit the staff branch. Legacy rows need backfill. |
| Prescription VA transfer | **FAIL → fixed in migration** | High | All 3 prescriptions had null VA while examinations held VA. New exams now copy aided→unaided VA via `trg_exam_va_to_rx`; historical rows need backfill. |
| Prescription approval | **FAIL** | High | No approval UI; schema/trigger additions exist in migrations but are unapplied. |
| Prescription expiry enforcement | **FAIL → fixed in migration** | High | `valid_till` populated but never checked at order creation. `20261217000010` now blocks expired/inactive Rx for new orders. |
| Prism / segment / fitting height | **FAIL** | High | Columns added in `0042_schema_hardening.sql` only; no UI, writer or release gate. |
| Cylinder/axis pairing | **PARTIAL → fixed** | High | UI warned; exam action and DB trigger now reject incomplete pairs. |
| Reserved stock | **FAIL** | Medium | `stock` has no usable reservation flow; `reserved_qty` is schema-only in `0042_schema_hardening.sql`. |
| Negative stock / oversell backstop | **PASS** | - | No negative rows; `apply_movement()` locks the stock row and `stock_qty_check` remains. |
| Transfer traceability | **PARTIAL** | Medium | `transfer_out`/`transfer_in` movements exist but notes are null and no shared transfer ID; not atomic. |
| Barcode uniqueness | **FAIL → fixed in migration** | High | No DB constraint; unique partial index now supplied. Current data has no duplicate barcodes. |
| Historical invoice product details | **PASS** | - | `sale_lines` snapshots `description`, `unit_price`, `tax_pct`, `hsn`. |
| Payment methods actually used | **PARTIAL** | Medium | All 6 payments and 7 cashbook rows are cash; `online_payments` empty; Razorpay keys blank. |
| Overpayment guard | **PASS** | - | Trigger rejects `paid_total + amount > grand_total`. |
| Reflected refund | **FAIL** | High | `CN-0001` refund exists in cashbook but `ORD-0003` still shows `paid_total = 3000` / `payment_status = paid`. |
| Day closing / cashbook | **PASS** | - | 2026-11-20 reconciles exactly (₹7,875 expected = actual). |
| Stock posting from purchase | **PARTIAL** | Medium | One invoice posted stock; another did not. `purchase_items` is free-text. |
| Empty modules | **FAIL** | High | `purchase_items`, `suppliers`, `repairs`, `expenses`, `family_members`, `gst_periods`, `online_payments` all empty. |
| Staff roles | **FAIL (test env)** | High | All 6 profiles are `owner`; RBAC scenarios cannot be exercised. |
| Audit trail | **PARTIAL** | - | 100+ rows exist; staff-permission and tax-setting changes were not uniformly logged until new migration. |

---

## 4. Fixes implemented in this pass

All source changes pass `tsc --noEmit` for both workspaces. **Migrations are supplied but NOT applied to the live database** (read-only scope) — run them in staging first.

| # | Fix | Files changed | Verification |
|---|---|---|---|
| F1 | Removed stale `/my/login` page so the website builds; `route.ts` forwards the legacy URL. | deleted `apps/web/src/app/my/login/page.tsx` | website build |
| F2 | Recreated missing workspace dependency symlink. | `pnpm install --frozen-lockfile` | symlink present |
| F3 | Deactivated/unapproved staff lose org access at the RLS gate. | `20261217000010_critical_integrity_fixes.sql` §1 | static; staging required |
| F4 | Concurrent duplicate-mobile registration serialised by advisory lock; friendly error. | `20261217000010` §2 | static; duplicate pair must be merged first |
| F5 | Barcode uniqueness enforced for non-empty barcodes. | `20261217000010` §3 | current data clean |
| F6 | Expired/inactive/unapproved prescriptions rejected for new orders; quotations exempt. | `20261217000010` §4 | static; staging required |
| F7 | Cylinder-without-axis and axis-without-cylinder rejected in exam action **and** database. | `packages/business-rules/src/rx.ts`, `examination-actions.ts`, `20261217000010` §5 | `tsc --noEmit` |
| F8 | Aided/unaided VA from examination copied to the linked prescription in the same transaction. | `20261217000010` §6 | static; historical backfill outstanding |
| F9 | Customer phone stored digits-only; new customers attributed to staff branch; consent/phone history written best-effort. | `apps/erp/src/app/(app)/customers/actions.ts` | `tsc --noEmit` |
| F10 | Restored full `place_sale`: idempotency persisted/replayed, GST/HSN snapshots written, lab jobs created for lens lines, supply type/GSTIN retained. | `20261217000020_place_sale_restore.sql` | static; staging required |
| F11 | Refunds require owner/admin; permission and tax-setting changes audit logged; consent and phone-history tables added. | `20261217000030_roles_audit_consent.sql`, `customers/actions.ts` | `tsc --noEmit`; best-effort until migration applied |
| F12 | Resolved duplicate `0041`/`0042` migration versions by renaming new files to `20261217000010/20/30`. | `supabase/migrations/*` | `pnpm verify:migrations` → 76 unique versions |

### Migration rollout (staging, then production)

1. Merge `CUS-0006` into `CUS-0007` (or vice versa): move orders, prescriptions, payments, notes; preserve audit rows. This is required before any plain phone unique index.
2. Apply in lexical order: existing migrations → `0042_schema_hardening.sql` → `20261130000000_enforce_prescription_approval.sql` → `20261217000010` → `20261217000020` → `20261217000030`.
3. Backfill: historical prescription VA from `eye_examinations`; existing prescriptions to `review_status='approved'` before enabling the approval trigger.
4. Smoke-test: deactivated profile sign-in, duplicate phone, expired Rx order, double-click Pay, credit note by non-admin.
5. Only then schedule production inside a maintenance window. Note `0042_schema_hardening.sql` creates a **raw** `unique(org_id, phone)` index and will fail until step 1 is done.

---

## 5. Detailed test results (203 scenarios)

Status legend: PASS · PARTIAL · FAIL · BLOCKED · N/A. “fix” means a control now exists in source/migration but is unapplied or unverified at runtime.

### A. Customer management & CRM — 19

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| CRM-R001 | Duplicate mobile registration | PASS | `customers/actions.ts` checks phone/email and returns existing customer code; DB advisory lock added. |
| CRM-R002 | Consent opt-out persistence | PASS | Controlled checkbox + hidden input; opt-in timestamp cleared on opt-out. |
| CRM-R003 | Birthday greeting respects opt-out | PASS | `birthday-greeting/index.ts` filters `.eq("whatsapp_opt_in", true)`. |
| CRM-R004 | Abandoned cart respects opt-out | PASS | `abandoned-cart/index.ts` skips opted-out customers. |
| CRM-R005 | Search by phone | PASS | Client-side search works; no server pagination (low severity). |
| CRM-R006 | Search by name | PASS | Client-side search works. |
| CRM-R007 | Search by Vision ID | PASS | Client-side search works. |
| CRM-R008 | Customer 360 tabs | PARTIAL | Overview/Profile/Prescriptions/Orders/Repairs/Notes render; Family/Transactions absent. |
| CRM-R009 | Customer branch attribution | PARTIAL | New customers now get staff branch; 4 legacy rows still null. |
| CRM-R010 | Customer transfer between branches | FAIL | No transfer feature. |
| CRM-010 | Two staff register same phone | BLOCKED | Advisory lock + trigger added; concurrency run needs isolated DB (plan §9.1). |
| CRM-011 | Change customer mobile | PARTIAL | Phone normalised and history table added; searching the old number still fails. |
| CRM-012 | Merge duplicate profiles | FAIL | `CUS-0006`/`CUS-0007` duplicate confirmed; no merge tool. |
| CRM-013 | Multiple family members | FAIL | `family_members` table exists but empty; no ERP/portal management UI. |
| CRM-014 | Adult withdraws sharing permission | FAIL | No sharing-permission model. |
| CRM-015 | Opt out then opt back in | PARTIAL | `consent_events` table + best-effort writes added; no history UI, migration unapplied. |
| CRM-016 | Customer data export | FAIL | No export workflow/audit. |
| CRM-017 | Served by another branch | PARTIAL | Customer branch set at creation; no per-transaction serving-branch attribution. |
| CRM-018 | Customer with no mobile | PARTIAL | Phone nullable, name/Vision-ID search exists; no defined fallback policy. |

### B. Eye examination & prescription — 25

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| RX-R001 | Appointment booking | PASS | Booking drawer wired in appointments page. |
| RX-R002 | Edit / reschedule appointment | PASS | Edit drawer wired. |
| RX-R003 | Axis validation (0–180) | PASS | `rxRangeError` validates raw value before `fixAxis`. |
| RX-R004 | Record distance VA | PASS | Exam form and `save_eye_examination` persist VA. |
| RX-R005 | Record near VA | PASS | Same as RX-R004. |
| RX-R006 | Enter SPH/CYL/AXIS/ADD | PASS | Fields exist in exam form and prescription writer. |
| RX-R007 | Prescription OCR upload | PARTIAL | OCR service detects blur/rotation and confidence; HF model credits/availability still make live OCR unreliable. |
| RX-R008 | Prescription approval gate | PARTIAL | Review fields + approval trigger supplied; no approve/reject UI; enabling trigger would block all pending Rx. |
| RX-R009 | Expired prescription block | PARTIAL | `20261217000010` §4 blocks new orders; POS has no pre-submit warning. |
| RX-R010 | VA copied to prescription | PARTIAL | New exams copy VA via trigger; 3 historical prescriptions still null. |
| RX-R011 | Prism field | FAIL | Schema-only in `0042_schema_hardening.sql`; no input/writer. |
| RX-R012 | Segment height field | FAIL | Schema-only; no input/writer. |
| RX-R013 | Fitting height field | FAIL | Schema-only; no input/release gate. |
| RX-009 | OD/OS entered in reverse | PARTIAL | OD/OS labels exist; no explicit confirmation step. |
| RX-010 | Plano prescription with ADD | PARTIAL | ERP supports 0 SPH + ADD; web `RxForm` has no ADD field. |
| RX-011 | Different ADD per eye | PARTIAL | ERP stores `od_add`/`os_add` separately; web cannot enter ADD. |
| RX-012 | Cylinder without axis | PASS (post-fix) | `rxPairingError()` in exam action + `trg_rx_pairs` DB trigger. |
| RX-013 | Prescription with prism | FAIL | No capture path; web explicitly disclaims prism and has no referral block. |
| RX-014 | OCR with sideways/blurred image | PASS | `services/ocr/app/main.py` emits quality warnings; ERP view renders them; no automatic clinical approval. |
| RX-015 | OCR misreads minus as plus | PARTIAL | Signed values preserved and low confidence flagged; no mandatory sign-off after staff correction. |
| RX-016 | Prescription corrected after approval | PARTIAL | Audit/review schema supplied; no reapproval action or audit writer in app. |
| RX-017 | Prescription updated after order | PASS | `sales.rx_snapshot` plus print view use ordering-time values. |
| RX-018 | Rx expires during order processing | PASS (post-fix) | New-order trigger blocks expired Rx; in-flight orders keep snapshot. |
| RX-019 | Patient DOB changes | PARTIAL | DOB editable and generically audited; no age-related warnings. |
| RX-020 | Exam values copied to prescription | PARTIAL | VA copy trigger added; no prism/segment/fitting transfer and historical rows unbackfilled. |

### C. Frame & inventory — 23

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| INV-R001 | Create frame SKU | PASS | All attributes save. |
| INV-R002 | Receive stock against PO | PASS | `receiveStock()` uses atomic `stock_posted_at` claim; `purchase_items` still free-text. |
| INV-R003 | Barcode scan in POS | PASS | Barcode resolves to product. |
| INV-R004 | Stock deduction on sale | PASS | Sale movement posted via guarded `apply_movement()`. |
| INV-R005 | Transfer East→West | PARTIAL | Two manual steps; no shared transfer ID or atomicity. |
| INV-R006 | Damaged stock | PASS | Damage movement recorded. |
| INV-R007 | Missing stock adjustment | PASS | Adjustment movement recorded. |
| INV-R008 | Tray/rack location | PASS | `shelf_location` saved/displayed. |
| INV-R009 | Physical stock count | PASS | `stock_audit_sessions/lines`, `start_stock_audit`, `approve_stock_audit`, and `/stock-audits` UI exist. |
| INV-R010 | Sell out-of-stock item | PASS | Blocked with branch-aware toast. |
| INV-R011 | Reserved stock | FAIL | `reserved_qty` schema-only; no reserve UI/API. |
| INV-005 | Two branches sell last unit | BLOCKED | Row lock + check constraint exist; run plan §9.1 to prove. |
| INV-006 | Reserve a frame | FAIL | No reservation workflow. |
| INV-007 | Reservation expires | FAIL | No reservation or expiry concept. |
| INV-008 | Barcode reused on two products | PASS (post-fix) | `products_org_barcode_uq` partial unique index supplied. |
| INV-009 | SKU/barcode changed | PASS | Historical `sale_lines` retain snapshot. |
| INV-010 | Count while sales continue | PARTIAL | Count feature exists; concurrent reconciliation not executed (read-only scope). |
| INV-011 | Partial purchase receipt | FAIL | `stock_posted_at` is a single flag; no received-vs-pending quantities. |
| INV-012 | Excess/wrong item from supplier | FAIL | No quantity/product variance validation. |
| INV-013 | Return a sold frame | FAIL | No condition check or return approval. |
| INV-014 | Damaged frame to supplier | FAIL | No purchase-return workflow. |
| INV-015 | Unauthorised stock adjustment | PARTIAL | `stock_adjust` permission exists; all profiles are owner, so denial cannot be exercised. |
| INV-016 | Interrupted branch transfer | FAIL | Transfer is two independent writes; no rollback/pending state. |

### D. Lens catalogue & clinical recommendation — 23

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| LENS-R001 | Create lens package | PASS | Code/name/design/index/coating/price save. |
| LENS-R002 | Single vision journey | PASS | Journey completes. |
| LENS-R003 | Progressive journey | PASS | Package exists; clinical fitting controls missing (see ADV-1). |
| LENS-R004 | Bifocal journey | PASS | Journey completes. |
| LENS-R005 | Coating options + price | PASS | Coatings selectable with price deltas. |
| LENS-R006 | Lens price calculation | PASS | Base + index + addon totals computed. |
| LENS-R007 | Good/Better/Best/Premium tiers | FAIL | `tier` column schema-only; no UI naming. |
| LENS-R008 | Lens eligibility vs frame | FAIL | Range columns exist but no consumer; web hardcodes `power_eligible: true`. |
| LENS-R009 | Supplier/brand on lens package | FAIL | `supplier_id` schema-only; no drawer field. |
| LENS-R010 | Unsupported online Rx blocked | FAIL | Web configurator accepts any Rx with no referral. |
| LENS-R011 | ADD entered online | FAIL | Web `RxForm` has SPH/CYL/AXIS/PD only. |
| LENS-R012 | Supplier price master | FAIL | No lens `cost_price` UI/history. |
| LENS-006 | Different index choices, same Rx | PARTIAL | Price differences work; Rx-aware filtering does not (`rankPackages` unwired). |
| LENS-007 | Progressive with shallow frame | FAIL | No frame-height capture or compatibility check. |
| LENS-008 | Frame size vs lens blank diameter | FAIL | No blank-diameter field or rule. |
| LENS-009 | Wrong design for Rx | PARTIAL | POS soft warning for high ADD; no web warning/hard review. |
| LENS-010 | Change Rx after lens selection | FAIL | Configurator loads options once; no recalculation on Rx edit. |
| LENS-011 | Remove coating after adding | PASS | Addon toggle recomputes totals. |
| LENS-012 | Supplier changes lens price | PARTIAL | Online quotes lock price; ERP quotation conversion re-prices from catalogue. |
| LENS-013 | Package becomes inactive | PASS | Inactive packages excluded from new selection; historic lines snapshot. |
| LENS-014 | Progressive fitting measurements omitted | FAIL | No capture or release gate before lab release. |
| LENS-015 | Compare lens options | FAIL | “Compare” button has no handler; `CompareBar` is frame-only. |
| LENS-016 | Special-order lens no stock | PARTIAL | Lens lines create `to_buy` lab jobs; no explicit special-order/ETA metadata. |

### E. POS, billing & payments — 36

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| POS-R001 | Place order with consent | PASS | Try/catch + null guard prevents the original crash. |
| POS-R002 | Idempotency on retry | PARTIAL | `crypto.randomUUID()` sent; key persisted/replayed only after `20261217000020` is applied. |
| POS-R003 | Frame-only bill | PASS | Totals and stock correct. |
| POS-R004 | Cash payment | PASS | Payment row written. |
| POS-R005 | Partial payment | PASS | Balance tracked; status `lab_pending`. |
| POS-R006 | Invoice numbering | PASS | Sequential codes observed. |
| POS-R007 | GST calculation | PARTIAL | Tax computed; snapshots were discarded by baseline `place_sale`, restored in migration. |
| POS-R008 | Cancel order | PARTIAL | Cancel path incomplete on baseline data (`ORD-0003` remained ready). |
| POS-R009 | Double-click Pay | PARTIAL | Button guard + idempotency fix supplied; runtime retry not executed. |
| POS-R010 | UPI payment | BLOCKED | Razorpay keys blank; `online_payments` empty. |
| POS-R011 | Card payment | BLOCKED | Same as POS-R010. |
| POS-R012 | Bank payment | BLOCKED | Same as POS-R010. |
| POS-R013 | Split payment | FAIL | No multi-component payment capture. |
| POS-R014 | Refund partial quantity | FAIL | Credit note is whole-order cash; no line-level refund/restock. |
| POS-R015 | Discount frame but not lens | PARTIAL | `sale_lines.discount_pct` exists; POS line-level discount UI absent. |
| POS-R016 | Price change quotation → billing | FAIL | No quote-price lock on ERP conversion. |
| POS-R017 | Reprint invoice | PARTIAL | Print view exists; no dedicated reprint flow verified. |
| POS-R018 | Concurrent refund requests | BLOCKED | No concurrency guard; plan §9.3. |
| POS-R019 | Return against old invoice | FAIL | Original branch/price/payment references not retained on return. |
| POS-R020 | Outstanding balance across orders | FAIL | No customer-level ledger. |
| POS-R021 | Tax-inclusive vs exclusive | PARTIAL | `price_mode` logic present; tax snapshot restored in migration. |
| POS-R022 | Intra-state vs inter-state | PARTIAL | Supply type captured by restored `place_sale`; baseline discarded it. |
| POS-003 | Two cashiers bill same frame | BLOCKED | Stock row lock exists; run plan §9.1. |
| POS-004 | UPI succeeds, browser closes | BLOCKED | Webhook is fail-closed and dedupes, but needs gateway keys/test mode (§9.2). |
| POS-005 | UPI fails after order | BLOCKED | Needs gateway simulation (§9.2). |
| POS-006 | Split payment three methods | FAIL | No split-payment model. |
| POS-007 | Customer pays more than balance | PASS | DB overpayment trigger rejects. |
| POS-008 | Refund partial quantity | FAIL | Same as POS-R014. |
| POS-009 | Discount frame but not lens | PARTIAL | Same as POS-R015. |
| POS-010 | Price change quotation → billing | FAIL | Same as POS-R016. |
| POS-011 | Reprint invoice | PARTIAL | Same as POS-R017. |
| POS-012 | Concurrent refund requests | BLOCKED | Same as POS-R018. |
| POS-013 | Return against old invoice | FAIL | Same as POS-R019. |
| POS-014 | Outstanding balance across orders | FAIL | Same as POS-R020. |
| POS-015 | Tax-inclusive vs exclusive | PARTIAL | Same as POS-R021. |
| POS-016 | Intra-state vs inter-state | PARTIAL | Same as POS-R022. |

### F. Orders, lab processing & delivery — 12

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| ORD-001 | Frame + lens + coating order | PARTIAL | Lines persist; lab job creation restored in `20261217000020`. |
| ORD-002 | Order sent to external supplier | FAIL | No supplier field/assignment in lab job UI. |
| ORD-003 | Lens received with wrong power | FAIL | No receipt validation; prism/OC/fitting/segment/markings/frame condition cannot be verified. |
| ORD-004 | Lab job reassigned | FAIL | No reassignment history. |
| ORD-005 | Delayed beyond promised date | FAIL | `due_date` exists; no delay alert/notification. |
| ORD-006 | Partial completion | FAIL | No per-item completion state. |
| ORD-007 | QC failure | FAIL | No QC gate blocking delivery. |
| ORD-008 | Remake due to supplier error | FAIL | Rework note exists; no remake entity/cost traceability. |
| ORD-009 | Customer changes frame after ordering | FAIL | No recalculation/approval flow. |
| ORD-010 | Customer changes Rx after ordering | PARTIAL | Snapshot protects the order; no amendment authorisation/remake. |
| ORD-011 | Delivered from another branch | FAIL | No cross-branch fulfilment record. |
| ORD-012 | Customer does not collect | FAIL | No 30-day reminder/uncollected workflow. |

### G. Repairs, warranty & after-sales — 9

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| SVC-001 | Repair without original invoice | FAIL | `repairs` table empty; no verification policy. |
| SVC-002 | Warranty valid | FAIL | No warranty eligibility engine. |
| SVC-003 | Warranty expired | FAIL | No eligibility engine. |
| SVC-004 | Repair requires spare part | FAIL | No part-stock linkage. |
| SVC-005 | Repair rejected by customer | FAIL | No estimate rejection/closure history. |
| SVC-006 | Frame exchanged under warranty | FAIL | No replacement traceability. |
| SVC-007 | Before/after photo missing | FAIL | Photo columns exist but no mandatory validation. |
| SVC-008 | Free adjustment vs paid repair | FAIL | No service-charge policy. |
| SVC-009 | Same complaint returns | FAIL | No repeated-complaint history view. |

### H. Purchasing & suppliers — 8

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| PUR-001 | PO approved before issue | FAIL | `purchase_orders` tables exist; no approval workflow/history. |
| PUR-002 | Partial supplier invoice receipt | FAIL | No received-vs-pending quantities. |
| PUR-003 | Invoice differs from PO | FAIL | No variance highlighting. |
| PUR-004 | Purchase return | FAIL | No supplier return/debit note flow. |
| PUR-005 | Supplier payment partial | FAIL | No supplier ledger/payment allocation. |
| PUR-006 | Duplicate supplier invoice | FAIL | No invoice-number uniqueness check. |
| PUR-007 | Supplier price changes | PARTIAL | Historical sale lines snapshot prices; purchase cost history absent (`purchase_items` empty). |
| PUR-008 | Goods received at wrong branch | FAIL | No branch validation on receipt. |

### I. Accounts, GST & finance — 14

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| FIN-001 | Daily sales vs invoices | PARTIAL | Reports exist; full reconciliation not automated. |
| FIN-002 | POS cash vs cashier closing | PASS | 2026-11-20 closing reconciles to ₹7,875 exactly. |
| FIN-003 | UPI collections vs gateway | BLOCKED | Gateway keys/settlement data unavailable. |
| FIN-004 | Card settlement deductions | BLOCKED | Same as FIN-003. |
| FIN-005 | Advance then delivery next month | FAIL | No advance liability recognition. |
| FIN-006 | Supplier purchase + payment | FAIL | `suppliers` / `purchase_items` empty. |
| FIN-007 | Stock valuation | PARTIAL | Product cost columns exist; no valuation report comparison. |
| FIN-008 | Frame and lens gross margin | PARTIAL | Cost/selling data exists; margin report incomplete. |
| FIN-009 | Expense wrong branch | FAIL | `expenses` table empty. |
| FIN-010 | Refund after tax invoice | FAIL | Credit note does not reduce sale `paid_total`; no tax reversal. |
| FIN-011 | Month-end closing | FAIL | No period-close totals workflow. |
| FIN-012 | Closed-period transaction edited | FAIL | No closed-period restriction. |
| FIN-013 | GST settings changed | PARTIAL | Sale-line tax snapshots restored in migration; no rate-change policy. |
| FIN-014 | Export GSTR-1 | N/A | Statutory filing needs accountant sign-off and external validation. |

### J. Staff, permissions & audit — 10

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| RBAC-001 | Cashier changes lens cost | FAIL | All profiles owner; no exercised denial. |
| RBAC-002 | Sales staff large discount | PARTIAL | `max_staff_discount_pct` check exists in `place_sale`; no approval workflow. |
| RBAC-003 | Optometrist refund | PARTIAL | `is_admin()` guard added in `20261217000030`; unapplied and untestable with all-owner profiles. |
| RBAC-004 | Manager another branch finance | FAIL | No cross-branch denial test; branch permissions not exercised. |
| RBAC-005 | Former employee login | PARTIAL | `current_org()` now honours `deactivated`; unapplied. |
| RBAC-006 | Staff changes Rx after approval | FAIL | No approval state or reapproval gate in app. |
| RBAC-007 | Two managers approve same refund | BLOCKED | Needs non-owner roles + concurrency (§9.3). |
| RBAC-008 | Owner changes permissions | PARTIAL | Audit trigger added; no non-owner fixtures. |
| RBAC-009 | Session expires during transaction | BLOCKED | Needs session-expiry simulation. |
| RBAC-010 | Direct API access without permission | FAIL | Baseline `current_org()` omitted `deactivated`; RLS policy breadth needs IDOR probe (§9.4). |

### K. Website & customer portal — 12

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| WEB-001 | Website order creates ERP order | PARTIAL | Checkout/order-confirm path exists; end-to-end not executed. |
| WEB-002 | Customer cancels online order | FAIL | No online cancellation updating ERP/payment. |
| WEB-003 | Product out of stock after listing | PARTIAL | Catalogue reads stock; no realtime availability guarantee. |
| WEB-004 | Online appointment booking | FAIL | Portal has appointments page; no write path to ERP appointments. |
| WEB-005 | Online prescription upload | PARTIAL | Documents feature exists; association/security needs runtime test. |
| WEB-006 | OTP login on another device | PARTIAL | Supabase OTP configured; multi-device behaviour untested. |
| WEB-007 | Website payment fails | BLOCKED | Requires Razorpay test mode (§9.2). |
| WEB-008 | ERP price change reflects website | PARTIAL | Catalogue is DB-driven; no publish workflow. |
| WEB-009 | Website order fulfilled another branch | FAIL | No branch fulfilment flow. |
| WEB-010 | Another customer's prescription URL | PARTIAL | Portal lockdown migrations exist; IDOR probe blocked (§9.4). |
| WEB-011 | Content saved as draft | FAIL | CMS `is_active` exists; no draft/publish state. |
| WEB-012 | Product image removed | PARTIAL | URLs stored; broken-image behaviour not tested. |

### L. Reports, backup & reliability — 12

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| SYS-001 | 5–10 concurrent staff | BLOCKED | Needs load test in isolated DB (§9.5). |
| SYS-002 | Database temporarily unavailable | BLOCKED | Needs fault injection. |
| SYS-003 | Refresh during saving | PARTIAL | Idempotency restored in migration; runtime retry not executed. |
| SYS-004 | Backup and restore | BLOCKED | Needs clean DB and restore drill (§9.6). |
| SYS-005 | Migration applied to staging | BLOCKED | Migrations deliberately not applied (§9.7). |
| SYS-006 | Failed migration rollback | BLOCKED | Needs staging fault injection. |
| SYS-007 | Search large dataset | BLOCKED | No 10k-row fixture; client-side search would not scale. |
| SYS-008 | Export large report | BLOCKED | No 10k-row fixture. |
| SYS-009 | Internet disconnect during payment | BLOCKED | Gateway/network simulation needed (§9.2). |
| SYS-010 | Six-hour offline POS | FAIL | No offline mode; cash-only offline policy not implemented. |
| SYS-011 | Refresh after transaction | PARTIAL | Server state is source of truth; no E2E refresh check. |
| SYS-012 | Two users edit one record | BLOCKED | No optimistic locking/version column; needs conflict test design. |

---

## 6. Advanced optical scenarios

The user-supplied prompt listed 10 advanced scenarios. Only five scenario texts could be recovered from the workspace/audit notes; scenarios 6–10 are marked BLOCKED pending the original wording. Re-send that list and I will add the missing rows.

| ID | Scenario | Status | Evidence / gap |
|---|---|---|---|
| ADV-1 | Progressive lens end-to-end | PARTIAL | Progressive packages, ADD capture and lab job creation exist; online Rx lacks ADD/prism/fitting height; no approval or fitting release gate. |
| ADV-2 | High prescription / high power | PARTIAL | `lensRecommendation.ts` flags high power and ranks packages but has no importers; web hardcodes eligibility true; no referral block. |
| ADV-3 | Prescription change / remake | PARTIAL | Rx snapshot + rework note exist; no remake entity, cost attribution, original/replacement link or amendment authorisation. |
| ADV-4 | Multi-lens order | PASS (static) | `place_sale` loops all lines, writes one `sale_lines` row per line and one lab job per lens line; needs mixed-cart E2E. |
| ADV-5 | Family member purchase | PARTIAL | `family_members` and `prescriptions.family_member_id` exist; portal page is WhatsApp CTA only; no selector/linked purchase flow. |
| ADV-6 | Scenario text not recovered | BLOCKED | Please re-supply the original item 6. |
| ADV-7 | Scenario text not recovered | BLOCKED | Please re-supply the original item 7. |
| ADV-8 | Scenario text not recovered | BLOCKED | Please re-supply the original item 8. |
| ADV-9 | Scenario text not recovered | BLOCKED | Please re-supply the original item 9. |
| ADV-10 | Scenario text not recovered | BLOCKED | Please re-supply the original item 10. |

---

## 7. Technical / operational audit

| ID | Check | Status | Evidence / gap |
|---|---|---|---|
| T-01 | Build and typecheck | PARTIAL | Source typechecks clean; full `pnpm build` hit a turbo `spawn UNKNOWN` Windows issue — re-run in CI. |
| T-02 | Auth & tenant isolation | PARTIAL | RLS uses `current_org()` uniformly; deactivation fix pending; all profiles owner so negative tests impossible. |
| T-03 | Audit logging | PARTIAL | Broad `audit_log`; new triggers cover profiles/settings; Rx approval audit writer missing. |
| T-04 | Data retention / consent lifecycle | FAIL | Consent flags stored; no retention, purge, anonymisation or deletion schedule. |
| T-05 | Secrets management | FAIL | Real service-role JWTs present in `apps/web/.env.local` and `apps/erp/.env.local`; rotate and keep out of builds/repos. |
| T-06 | Responsive ERP | PASS | Responsive `sm:`/`md:`/`lg:` grid patterns verified across ERP pages. |
| T-07 | Production readiness | FAIL | 79 FAIL and 24 BLOCKED scenarios; 20 critical/high PR blockers remain open. |
| T-08 | Migration versioning | PASS (post-fix) | Duplicate versions renamed; `pnpm verify:migrations` → 76 unique. |
| T-09 | Webhook & rate limiting | PARTIAL | Webhook verifies HMAC fail-closed and resolves org via `getOrgId()`; rate-limit helpers present; no gateway keys for live proof. |
| T-10 | CSRF | PARTIAL | Next.js SameSite cookies/action origin checks reduce risk; no explicit CSRF token on standalone API routes. |
| SEC-001 | Unique customer phone | PARTIAL | Advisory lock trigger added; plain unique index intentionally disabled until duplicates merged. |
| SEC-002 | Unique customer email | PARTIAL | Index supplied in `0042_schema_hardening.sql`, unapplied. |
| SEC-003 | Hardcoded org in webhook | PASS | Source uses `getOrgId()`; HMAC fail-closed. |
| SEC-004 | Hardcoded org in web pages | PARTIAL | Source clean; stale `.next` build artifacts still contain literal org UUID — clean rebuild before deploy. |
| SEC-005 | CSRF tokens on API routes | PARTIAL | See T-10. |
| SEC-006 | Auth rate limiting | PASS | `apps/web/src/lib/ratelimit.ts` and RPC `rate_limit_hit` used on OCR/checkout/order-confirm/track-order. |
| SEC-007 | Service role in client bundle | PARTIAL | Source browser client uses anon key only; stale `.next/server` chunks contain secrets — purge build output and rotate. |

---

## 8. Known data defects requiring a one-off fix

| Defect | Evidence | Recommended action |
|---|---|---|
| Duplicate customer phone `9000000001` | `CUS-0006`, `CUS-0007` | Merge before enabling any unique phone index. |
| All prescription VA null | 3 prescriptions | Backfill from `eye_examinations` aided→unaided VA. |
| `ORD-0003` paid_total not reduced by `CN-0001` | Cashbook ₹1,500 refund; sale still ₹3,000 paid | Accountant review; post corrective credit-note linkage, do not delete audit rows. |
| `branch_id` null on 4 customers | Read-only query | Backfill from first transaction/serving branch. |
| All profiles `owner` | 6 profiles | Create cashier/optometrist/manager fixtures in isolated DB to unblock RBAC tests. |

---

## 9. Appendix — ready-to-run plans for BLOCKED tests

Run all plans in a **fresh isolated database** seeded with test fixtures prefixed `QA-`. Never against the live dev project.

### 9.1 Concurrency (CRM-010, INV-005, POS-003)
1. Seed product `QA-FRAME` with `stock.qty = 1` at one branch and customer `QA-C1`.
2. Open two authenticated sessions (two browsers or two Playwright contexts) on the same branch.
3. Both add the frame to POS and submit within the same 100 ms window; for CRM-010 both submit the same phone.
4. Assert: exactly one sale/customer is created; stock is `0`, never `-1`; exactly one `sale` movement of `-1`; loser receives a readable error and no partial row.
5. Rollback: mark the test sale cancelled and post a corrective `return` movement; keep audit rows.

### 9.2 Payment failure / recovery (POS-004, POS-005, WEB-007, SYS-009, FIN-003)
1. Configure Razorpay **test** keys and webhook secret; point webhook to a staging URL.
2. Create a test order, initiate UPI, then (a) close the browser after `payment.captured`, (b) force a gateway failure after order creation, (c) disconnect the client mid-payment.
3. Assert: webhook dedupes by `razorpay_payment_id`; one sale; `payment_status` matches gateway state; no false paid confirmation; failed payment leaves order unpaid/pending.
4. Reconcile `online_payments` against the gateway settlement report including fees/refunds.

### 9.3 Refund concurrency (POS-012, POS-R018, RBAC-007)
1. Create a paid test sale and two non-owner refund sessions (after role fixtures exist).
2. Both issue a credit note simultaneously.
3. Assert: at most one credit note; sale `paid_total` reduced exactly once; stock restocked once; second caller denied/409; audit log records actor and role.
4. Verify `trg_credit_notes_role_guard` blocks optometrist/cashier roles.

### 9.4 IDOR / direct API (RBAC-010, WEB-010)
1. Create two orgs with users A and B; give B a valid JWT.
2. Call REST and RPC endpoints with B's token but A's row IDs (customer, prescription, sale, lab order).
3. Assert every response is empty or 403/404; `current_org()` denies deactivated profile; `security_invoker` views return only A rows to A.
4. Keep the probe queries in `supabase/tests/rls_audit.sql`.

### 9.5 Load (SYS-001)
1. Seed 10k customers/products and 10 concurrent staff sessions.
2. Run checkout, search, customer save and stock transfer for 10 minutes.
3. Assert no 5xx, no deadlocks, p95 < 2 s for search, no stock oversell; capture DB CPU/lock waits.

### 9.6 Backup / restore (SYS-004)
1. Take a logical backup of the isolated DB; seed a known sale and stock movement.
2. Restore into a clean database and run `pnpm verify:migrations` plus row-count/total checks.
3. Assert sale totals, stock quantities, audit log and code sequences match exactly.

### 9.7 Migration staging (SYS-005, SYS-006)
1. Clone production schema with sanitised data; apply all migrations in filename order using Supabase CLI.
2. Verify `pnpm verify:migrations` reports unique versions and no SQL errors.
3. Deliberately apply a bad migration in a throwaway clone, record recovery steps, then drop that clone.
4. Only after staging passes, schedule production with a backup and rollback script.
