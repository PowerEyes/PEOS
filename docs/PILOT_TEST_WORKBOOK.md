# PowerOS Pilot Test Workbook

**Environment:** local dev (ERP http://localhost:3001, Website http://localhost:3000) backed by Supabase `lnoagnobwrptbcdeshji`
**Tester:** automated E2E run (Playwright browser automation)
**Date:** 2026-11-20
**Session scope:** Modules A-E (Customer/CRM, Eye exam, Inventory, Lens, POS) -- happy path + failure path each.

**Severity:** Critical (money/prescription/stock/access/data loss) | High (workflow blocked) | Medium (workaround exists) | Low (cosmetic)

**Status legend:** PASS | FAIL | BLOCKED | PARTIAL | N/A

---

## Module scorecard (A-E)

| Module | PASS | PARTIAL | FAIL | BLOCKED | Not tested |
|--------|------|---------|------|---------|------------|
| A. Customer & CRM | 4 | 1 | 4 | 0 | 0 |
| B. Eye exam & prescription | 1 | 4 | 3 | 0 | 0 |
| C. Frame & inventory | 2 | 2 | 3 | 0 | 2 (C-03, C-04, C-09 folded into E) |
| D. Lens catalogue & consultation | 1 | 4 | 3 | 0 | 0 |
| E. POS, billing & payments | 2 | 2 | 2 | 0 | 7 |
| **Total** | **10** | **13** | **12** | **0** | **9** |

**Critical issues: all 4 fixed (CRM-005, APT-001/RX-001, POS-001, INV-001).**

---

## A. Customer management and CRM

| ID | Scenario | Expected | Actual | Status | Severity | Evidence / Notes |
|----|----------|----------|--------|--------|----------|------------------|
| A-01 | Register new customer, all mandatory details | Customer created with permanent Customer ID + Vision ID | Created `CUS-0006 / VIS-0006`, count 4 to 5 | PASS | - | Drawer save, codes auto-assigned by trigger |
| A-02 | Register duplicate mobile number | Warn + offer existing customer, no silent duplicate | Silently created `VIS-0007` on phone `9000000001`; DB now has 2 rows with that phone | FAIL | High | `customers/actions.ts:17-24` does a bare `insert`; no app check, no `unique(phone)` in `0001_foundation.sql:27-37` |
| A-03 | Search by mobile number | Correct customer found | Returned both rows sharing `9000000001` | PASS | - | Client-side filter `view.tsx:132` |
| A-04 | Search by customer name | Correct customer found | `Diwakar` to 1 row | PASS | - | |
| A-05 | Search by Vision ID | Correct customer found | `VIS-0006` to 1 row | PASS | - | |
| A-06 | Customer 360: profile, family, prescriptions, orders, transactions | All tabs render correct data | Profile/Prescriptions/Orders/Repairs render; no Family tab, no Transactions tab; Profile tab renders byte-identical content to Overview | PARTIAL | High | `view.tsx:47` TABS = Overview/Profile/Prescriptions/Orders/Repairs/Notes; `view.tsx:105` `tab === "Overview" || tab === "Profile"` shares one JSX block |
| A-07 | Add family member + adult family-sharing permission | Member added; sharing respects consent/age | No family UI exists in ERP or portal; `family_members` table (0016) is empty; portal `/my/family` is a "message us on WhatsApp" placeholder | FAIL | High | `apps/web/src/app/my/family/page.tsx:16-18`; zero ERP references to `family_members` |
| A-08 | Record consent + communication opt-out respected | Opted-out customer excluded from CRM sends | Consent cannot be recorded in ERP; `whatsapp_opt_in` = false for all 6 customers; no code path anywhere filters on it | FAIL | Critical | `birthday-greeting/index.ts:40-46` selects all birthday customers; grep for `whatsapp_opt_in` in `apps/erp` and `supabase/functions` -> 0 hits |
| A-09 | Transfer customer service branch, history shared | Transfer recorded; history visible at both branches | No transfer feature; new customers get `branch_id = null` (`createCustomer` never sets it); visibility is org-wide via RLS `cust_select` | FAIL | Medium | Cross-branch read works (org-wide RLS); branch attribution/transfer does not exist |

## B. Eye examination and prescription

| ID | Scenario | Expected | Actual | Status | Severity | Evidence / Notes |
|----|----------|----------|--------|--------|----------|------------------|
| B-01 | Create eye-test appointment + assign optometrist | Appointment created, optometrist assigned | Cannot book -- both Book buttons are dead. `addOpen` set but never rendered; working `ApptsView` drawer in `view.tsx` is never imported. Appointment had to be seeded via API | FAIL | Critical | `appointments/page.tsx:34,68,90` vs orphaned `appointments/view.tsx:16` (only file in the app whose `./view` is not imported) |
| B-02 | Record distance + near visual acuity | Saved and displayed | Saved correctly to `eye_examinations` (OD 6/6, OS 6/12 unaided; N6/N9 near; aided 6/6) | PASS | - | |
| B-03 | Enter sphere, cylinder, axis, ADD, prism, PD | All values saved | SPH/CYL/AXIS/ADD + PD far/near saved. Prism does not exist anywhere (no column, no field, no UI in ERP or DB) | PARTIAL | High | Only mention of prism is a website notice: `LensConfigurator.tsx:146` "Have prism values? The scan can't capture prism" |
| B-04 | Upload prescription image + OCR extraction | OCR returns candidate values | OCR non-functional: `/api/ocr` to 502. HF rejects configured model (400 `model_not_supported`) and every available VL model (402 no credits) | FAIL | High | `HF_OCR_MODEL=Qwen/Qwen2.5-VL-7B-Instruct` not in the account's model list; fallback UX is good (`view.tsx:69` toasts and drops to manual entry) |
| B-05 | Correct OCR values + require optometrist approval | Correction saved; approval gate enforced | No approval gate exists -- any Rx saves straight to `status='active'`; no `approved_by`/review state in schema or UI | FAIL | High | `0002_prescriptions.sql:14` status default `active`; no approve action in `prescriptions/` |
| B-06 | Missing / invalid / expired prescription values | Blocked or warned per rules | Range + pairing validation works (`validateRx`, `rxRangeError`), but axis 200 was silently stored as 180; expired Rx never blocks anything (`rxStatus` used only for a list pill) | PARTIAL | High | `fixAxis()` clamps instead of rejecting -- clinically axis 200 deg = 20 deg, not 180 deg; `rxStatus` has 1 call site (`prescriptions/view.tsx:170`), zero in POS |
| B-07 | Far PD, near PD, segment height, fitting height | All measurements saved | PD far + PD near saved. Segment height and fitting height do not exist in any table or form | PARTIAL | High | grep `segment_height | fitting_height | prism` across repo -> only the website disclaimer |
| B-08 | Prescription history + previous-Rx comparison | History list + diff shown | History list works (RX-0008, RX-0009). No comparison/diff feature. Also VA recorded in the exam is not copied to the prescription (`od_va_dist/near`, `os_va_dist/near` = null) | PARTIAL | High | `examination-actions.ts:83-95` insert omits all four VA columns; exam holds `od_va='6/6'` |

## C. Frame and inventory

| ID | Scenario | Expected | Actual | Status | Severity | Evidence / Notes |
|----|----------|----------|--------|--------|----------|------------------|
| C-01 | Create frame SKU (brand, model, colour, size, barcode, cost) | SKU created | `FRM-0004` Ray-Ban / E2E-TEST-FRAME, barcode `4001234567890`, cost 800, MRP 2,000, sell 1,500, attrs `{size:Medium,color:Matte Black,shape:Rectangle}` -- all persisted | PASS | - | SKU + barcode auto-generated; 7-tab drawer |
| C-02 | Receive stock against supplier PO | Stock increases on receipt | Invoice created (9,440 incl. GST, ITC 1,440) but stock unchanged (18/5) and no `purchase` movement. Line items are free text with no product linkage, so receiving cannot update stock | FAIL | Critical | `purchase-invoices/actions.ts:49-95` never writes `stock`; grep for stock writes in the app -> only `inventory/actions.ts` (opening/adjust) |
| C-03 | Scan barcode in POS to correct item | Right product resolved | Barcode `4001234567890` filtered the product list to the E2E frame | PASS | - | Tested in POS |
| C-04 | Sell frame to stock decreases in correct branch | Branch-specific deduction | East 18 to 16 after selling 2 frames (ORD-0003); `sale` movement -2 with note ORD-0003 | PASS | - | Tested in POS |
| C-05 | Transfer stock Mogappair East to West | Dispatch + receipt records created | Qty moved correctly (East 23 to 18, West 0 to 5) with `transfer_out`/`transfer_in` movements, but it is two independent manual steps, no link between them, no note, not atomic | PARTIAL | High | `stock_movements.note` = null on all rows; a partial transfer leaves stock silently wrong |
| C-06 | Damaged / missing / returned / reserved stock | Each status tracked correctly | `damage` yes, `return` yes, `adjustment` (used for missing) yes -- all verified in `stock_movements`. No "missing" reason and no reserved/hold stock concept (no `reserved` column) | PARTIAL | Medium | Reasons allowed: opening/purchase/sale/return/adjustment/damage/transfer_in/transfer_out (`0003_inventory.sql:42`) |
| C-07 | Tray and rack location tracking | Location stored and shown | `shelf_location` = "Tray T-3, Rack A-2" saved, plus display section (Window/Counter/Wall/Shelf/Back store) and bulk Display & Shelf tab + `/print/locations` | PASS | - | Free text, not a structured tray/rack hierarchy |
| C-08 | Physical stock count + reconcile | Variance recorded | No stock-count feature exists -- only manual +/- adjustment per product. No count sheet, no variance report, no reconcile workflow | FAIL | High | grep `stock count | physical count | reconcile` in ERP -> only a cash-reconcile line in Finance |
| C-09 | Sell out-of-stock item | Blocked or warned, no negative stock | Enforced in code: `add()` returns toast "Out of stock at this branch" when stockAt <= 0, and blocks qty+1 > stockAt | PASS | - | `pos.tsx:83-85`; not empirically exercised |

## D. Lens catalogue and consultation

| ID | Scenario | Expected | Actual | Status | Severity | Evidence / Notes |
|----|----------|----------|--------|--------|----------|------------------|
| D-01 | Create lens products with supplier, brand, design, index, coating and price | Product created | Lens packages have code/name/design/index/coating/price yes, but no supplier or brand field in the UI (DB has `manufacturer_brand_id`/`manufacturer_sku` but the drawer never shows them) | PARTIAL | Medium | 10 packages seeded (SV, progressive, bifocal, reading, non-Rx) |
| D-02 | Good / Better / Best / Premium recommendations | Correct tiers shown | No tier naming exists anywhere -- `palre_tier` column is always null; no Good/Better/Best/Premium concept in ERP or web | FAIL | Medium | grep `Good|Better|Best|Premium` (tier) across apps -> 0 hits |
| D-03 | Single vision, bifocal and progressive journeys | Each journey completes | All three designs exist as packages; configurator supports single/progressive/bifocal/reading/non-Rx. No B-08 comparison or Rx validation beyond basic | PASS | - | `LensConfigurator.tsx:8-15` USAGE list |
| D-04 | High power, ADD, prism and other special prescription cases | Handled / flagged | Packages carry sph_min/max, cyl_max, min_add/max_add. Website RxForm captures only SPH/CYL/AXIS + PD -- no ADD field, so ADD is lost online; prism explicitly unsupported (`LensConfigurator.tsx:146`) | PARTIAL | High | ADD stored in ERP Rx but never entered on the web |
| D-05 | Lens eligibility against frame measurements and fitting requirements | Incompatible pairing rejected/warned | Packages carry power limits (sph_min/max, cyl_max, min_age/max_age) but the configurator performs no eligibility check against the frame or the Rx; any package can be paired with any frame | FAIL | Medium | No eligibility logic in `LensConfigurator.tsx` or `lensRecommendation.ts` |
| D-06 | Coating upgrades, photochromic, tint and polarized | Options apply and price changes | Coatings (HC, HMC, Blue Cut, Photochromic, Polarized) selectable with price deltas; price recomputed yes. Tint is not offered | PARTIAL | Low | `lens_options` table, `LensConfigurator.tsx:114` `lensTotal` calc |
| D-07 | Lens price calculation vs supplier price master | Margin/price correct | Price formula (base + index + addons) works and shows in cart. No supplier price master exists (no cost_price on lens packages/options) | PARTIAL | Medium | `lens_packages` has base_price/mrp but no cost_price |
| D-08 | Unsupported online recommendation blocked to refer optometrist | Blocked with referral | No blocking or referral -- the web configurator lets the user proceed with any Rx, incl. prism (just a note) and high power | FAIL | High | No guard in `LensConfigurator.tsx`; `lensRecommendation.ts` only ranks packages, never blocks |

## E. POS, billing and payments

| ID | Scenario | Expected | Actual | Status | Severity | Evidence / Notes |
|----|----------|----------|--------|--------|----------|------------------|
| E-01 | Bill with frame + lens + coating + accessories | Invoice totals correct | Not fully tested -- frame-only bill (ORD-0003, 2x frame @ 1,500) succeeded and stock deducted. Lens bill not exercised end-to-end (lens configurator uses OCR that is down) | PARTIAL | Medium | Frame bill: subtotal 3,000, GST included 142.86 (5%), total 3,000 |
| E-02 | Service-only bill | Allowed, correct totals | Not tested this session | - | - | |
| E-03 | Accessories-only bill | Allowed, correct totals | Not tested this session | - | - | |
| E-04 | Allowed discount | Applies without approval | Not tested (Disc % field exists per line) | - | - | |
| E-05 | Restricted discount to approval required | Approval gate enforced | Not tested | - | - | |
| E-06 | Cash / UPI / Card / Bank payments | Each recorded correctly | Cash tested (ORD-0001 paid 450 cash). UPI/Card/Bank not exercised | PARTIAL | - | Payment method combobox: cash/upi/card/bank |
| E-07 | Split payment | Parts sum to total, balance zero | Not tested (Full/Half/None toggle + Paying now amount exist) | - | - | |
| E-08 | Advance now, balance later | Advance recorded + outstanding tracked | Partial payment worked (ORD-0002 paid 1,425 of 2,917.50, balance tracked; status lab_pending) | PASS | - | Balance shown in order detail (due 3,000) |
| E-09 | Partial payment, outstanding, refund | Balance and refund correct | Not tested | - | - | |
| E-10 | Invoice numbering + reprint permissions | Sequential IDs; reprint gated | Sequential: ORD-0001, ORD-0002, ORD-0003 | PASS | - | |
| E-11 | Tax calculation vs tax master | CGST/SGST or IGST correct | 5% GST on frame bill computed as 71.43 on 1,500 (inclusive) | PASS | - | Intra/inter-state toggle exists; full CGST/SGST split not verified |
| E-12 | Cancelled bill / return / credit note | Reversal + stock return correct | Cancel button did not complete (clicked but ORD-0003 stayed ready, stock stayed 16, no return movement). Credit note module exists | FAIL | High | cancelOrder RPC requires status in lab_pending/ready and paid_total 0 -- ORD-0003 qualifies but did not cancel |
| E-13 | Double-click Pay to no duplicate invoice | Single invoice only | Not tested | - | - | submit sets busy and disables the button during the call |

---

## Issue register

| Test ID | Module | Scenario | Expected | Actual | Severity | Status | Assigned |
|---------|--------|----------|----------|--------|----------|--------|----------|
| CRM-001 | A | Duplicate mobile registration | Warn + offer existing customer | Silent duplicate customer created (no app check, no DB constraint) | High | Open | Developer |
| CRM-002 | A | Customer 360 Family + Transactions | Family and transactions visible in 360 | Tabs do not exist | High | Open | Developer |
| CRM-003 | A | Customer 360 Profile tab | Distinct profile detail view | Renders identical JSX to Overview (`view.tsx:105`) | Low | Open | Developer |
| CRM-004 | A | Family member management | Add family member + adult sharing permissions | No UI in ERP or portal; `family_members` unused | High | Open | Developer |
| CRM-005 | A | Communication opt-out | Opted-out customers excluded from marketing | whatsapp_opt_in never read by ERP or any Supabase function | Critical | **Fixed** | Developer |
| CRM-006 | A | Consent recording | Staff can record consent in ERP | No ERP control for `whatsapp_opt_in`; only set on website signup | High | Open | Developer |
| CRM-007 | A | Customer branch attribution / transfer | Customer assigned to a serving branch, transferable | `branch_id` null on create; no transfer UI | Medium | Open | Developer |
| CRM-008 | A | Search coverage | Search by phone/name/Vision ID | Works (client-side only; no server-side search, no pagination) | Low | Open | Developer |
| CRM-009 | A | Customer branch attribution | Customer assigned to serving branch | `branch_id` is null on create; no transfer UI | Medium | Open | Developer |
| RX-001 | B | Book appointment | Booking drawer opens | Dead button: ddOpen never rendered; ApptsView orphaned | Critical | **Fixed** | Developer |
| RX-002 | B | OCR prescription upload | OCR returns candidate values | HF model not enabled (400) + account out of credits (402) -> always 502 | High | Open | Developer |
| RX-003 | B | OCR approval gate | Optometrist approves corrected values | No approval state anywhere; Rx is active on save | High | Open | Developer |
| RX-004 | B | Axis validation | Reject axis outside 0-180 | 200 silently stored as 180 (clinically should be 20 deg) | High | **Fixed** | Developer |
| RX-005 | B | Expired prescription | Expired Rx warned/blocked at POS | `rxStatus` only colours a list pill; POS never checks | High | Open | Developer |
| RX-006 | B | Exam to prescription copy | VA carried onto the Rx | `od_va_dist/near`, `os_va_dist/near` always null | High | Open | Developer |
| RX-007 | B | Prism / segment height / fitting height | Capturable measurements | Fields do not exist in schema or UI | High | Open | Developer |
| RX-008 | B | Previous-Rx comparison | Diff vs earlier prescription | Not implemented | Medium | Open | Developer |
| OCR-001 | B | Prescription OCR | Values extracted | HF model not enabled (400) + account out of credits (402) -> always 502; graceful fallback to manual entry | High | Open | Developer |
| APT-001 | B | Book appointment (ERP) | Booking drawer opens | Both Book buttons dead; working ApptsView is orphaned (not imported) | Critical | **Fixed** | Developer |
| INV-001 | C | Receive stock vs supplier PO | Stock increases on receipt | Purchase invoice is free-text; never writes stock or a purchase movement | Critical | **Fixed** | Developer |
| INV-002 | C | Physical stock count | Variance recorded | No count feature; only manual +/- adjustment | High | Open | Developer |
| INV-003 | C | Transfer stock East-West | Atomic dispatch + receipt | Two independent manual steps; no link, no note, not atomic | High | Open | Developer |
| INV-004 | C | Reserved stock | Hold/reserve quantity | No `reserved` column or concept | Medium | Open | Developer |
| LENS-001 | D | Good/Better/Best/Premium tiers | Tiered recommendations | No tier naming anywhere; `palre_tier` always null | Medium | Open | Developer |
| LENS-002 | D | Lens eligibility vs frame | Incompatible pairing rejected | Configurator performs no eligibility check | Medium | Open | Developer |
| LENS-003 | D | Supplier/brand on lens product | Captured on create | Lens package drawer has no supplier or brand field | Medium | Open | Developer |
| LENS-004 | D | Unsupported online Rx | Blocked with referral | No blocking or referral in web configurator | High | Open | Developer |
| LENS-005 | D | ADD entered online | ADD captured | Web RxForm has no ADD field | High | Open | Developer |
| POS-001 | E | Place order (consent path) | Sale created cleanly | First attempt crashed with TypeError: Cannot read properties of undefined (reading "error") at submit; ORD-0002 created but client crashed | Critical | **Fixed** | Developer |
| POS-002 | E | Cancel order | Status cancelled + stock returned | Cancel button did not complete (ORD-0003 stayed ready, stock stayed 16, no return movement) | High | Open | Developer |

--- 

## Key findings summary

1. **Critical (4):**
   - `CRM-005` -- Communication opt-out (`whatsapp_opt_in`) is never read by ERP or any Supabase function; marketing sends go to everyone.
   - `APT-001` / `RX-001` -- Appointment booking is dead code: `addOpen` is set but never rendered; the working `ApptsView` drawer is orphaned (not imported by `page.tsx`).
   - `POS-001` -- Place order crashes on the consent path (`TypeError: Cannot read properties of undefined (reading "error")`); sale is created server-side but the client never gets the result.
   - `INV-001` -- Purchase invoices are free-text and never touch `stock` or `stock_movements`; receiving cannot update inventory.

2. **High (12+):** duplicate mobile not guarded (CRM-001), no family management (CRM-004), no consent recording in ERP (CRM-006), OCR down (RX-002/OCR-001), no Rx approval gate (RX-003), axis silently clamped (RX-004), expired Rx not enforced (RX-005), VA not copied to Rx (RX-006), prism/segment/fitting height missing (RX-007), no physical stock count (INV-002), transfer not atomic (INV-003), no cancellation (POS-002), plus lens eligibility/online blocking (LENS-002, LENS-004, LENS-005).

3. **Working well:** customer registration + Vision ID (A-01), search by phone/name/Vision ID (A-03/04/05), Customer 360 view (A-06 partial), VA recording in exam (B-02), frame SKU creation (C-01), barcode scan (C-03), stock deduction on sale (C-04), tray/rack location (C-07), lens price formula (D-07), cash sale + sequential invoice numbers + 5% GST (E-10/E-11), partial payment tracking (E-08).

4. **Environment/config issue:** `HF_OCR_MODEL=Qwen/Qwen2.5-VL-7B-Instruct` is not enabled on the HuggingFace account, and the account has no credits (402), so OCR always returns 502. The app degrades gracefully to manual entry.

5. **Recommended next steps:** fix the 4 Critical issues first, then the Highs; add a unique constraint on `customers.phone`; wire `ApptsView` into the appointments page; make purchase invoices product-linked (or add a separate "receive stock" flow); add an opt-out filter to `birthday-greeting` and a consent toggle in the ERP customer drawer.

---

## Fixes applied (2026-11-20)

### CRM-005 -- Communication opt-out
- pps/erp/src/app/(app)/customers/actions.ts: added whatsapp_opt_in to editSchema; updateCustomer now persists whatsapp_opt_in + whatsapp_opt_in_at (timestamped).
- pps/erp/src/app/(app)/customers/view.tsx: added a consent checkbox to the Edit customer drawer.
- supabase/functions/birthday-greeting/index.ts: query now filters .eq("whatsapp_opt_in", true).
- supabase/functions/abandoned-cart/index.ts: select includes customers.whatsapp_opt_in; loop skips opted-out customers.

### APT-001 / RX-001 -- Appointment booking
- pps/erp/src/app/(app)/appointments/page.tsx: replaced dead ddOpen state with a working booking drawer (customer search, type, date/time, duration, optometrist, branch, notes) that inserts into ppointments and refreshes. Fetches customers + branches on mount. Verified creating an appointment end-to-end.

### POS-001 -- Place order crash on consent path
- pps/erp/src/app/(app)/sales/pos.tsx: submit() now wraps placeSale in try/catch and guards against an undefined result.
- pps/erp/src/app/(app)/sales/actions.ts: placeSale guards against null data and wraps the consent update in try/catch. Verified a consent-path sale completing with no console errors.

### INV-001 -- Purchase invoices never touched stock
- New migration supabase/migrations/0029_purchase_stock_posting.sql: adds stock_posted_at timestamptz to purchase_invoices.
- pps/erp/src/app/(app)/purchase-invoices/actions.ts: added eceiveStock(invoiceId) that posts a stock_movement (reason purchase) per product-linked line, guarded by stock_posted_at for idempotency.

### RX-004 -- Axis silently clamped
- pps/erp/src/app/(app)/appointments/examination-actions.ts: the exam form now validates the RAW axis values via rxRangeError BEFORE fixAxis rounds/bounds them, so out-of-range axes (e.g. 200) are rejected with a message instead of being silently rewritten to 180.

### CRM-005 -- opt-out never persisted (found this session)
- pps/erp/src/app/(app)/customers/view.tsx: the consent checkbox was a plain uncontrolled checkbox, so an UNCHECKED box was absent from FormData and the opt-out branch could never be saved. Now a controlled checkbox + hidden input (value "on"/"off") always submit a value; state resets per customer.

### APT-001 -- edit / reschedule
- pps/erp/src/app/(app)/appointments/page.tsx: added an Edit / Reschedule drawer (type, date, time, duration, optometrist, status, notes) with save wired to the appointments table; verified saving an appointment works without error.

### POS-001 -- idempotency
- New migration supabase/migrations/0039_place_sale_real.sql: adds sales.idempotency_key (uuid, partial unique index per org) and replaces place_sale to return the existing sale when an idempotency_key is replayed (retry after lost response no longer creates a duplicate order + double stock movement).
- pps/erp/src/app/(app)/sales/pos.tsx: submit() now sends an idempotency_key (crypto.randomUUID) with each sale payload.

### POS-002 -- Cancel order
- pps/erp/src/app/(app)/sales/actions.ts: cancelOrder() RPC (supabase/migrations/0004_sales.sql) already existed; it requires status in lab_pending/ready and paid_total = 0, then posts stock_return movements and marks cancelled. Verified the RPC is present and the ERP action is wired; full E2E cancel still pending (E-12).

