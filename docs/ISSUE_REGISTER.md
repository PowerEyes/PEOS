# PowerOS Issue Register

**Last Updated:** 21 November 2026
**Total Open Issues:** 47
**Critical:** 12 | High: 20 | Medium: 12 | Low: 3

---

## Critical Issues (Must Fix Before Production)

| ID | Module | Issue | Expected | Actual | Status | Assigned | Target Date |
|----|--------|-------|----------|--------|--------|----------|-------------|
| CRM-001 | A | No unique constraint on customers.phone | Database prevents duplicate phone numbers | No unique constraint exists; app-level guard only | Open | Developer | TBD |
| CRM-002 | A | No unique constraint on customers.email | Database prevents duplicate emails | No unique constraint exists | Open | Developer | TBD |
| RX-003 | B | No prescription approval gate | Optometrist approves before Rx active | Rx is active on save; no approval state | Open | Developer | TBD |
| RX-005 | B | Expired prescription not enforced | Expired Rx blocks new orders | Expiry never blocks anything | Open | Developer | TBD |
| RX-007 | B | Prism/segment/fitting height missing | Fields exist and capture data | Fields do not exist in schema or UI | Open | Developer | TBD |
| INV-002 | C | Physical stock count missing | Count workflow with variance | Only manual +/- adjustment | Open | Developer | TBD |
| LENS-002 | D | Lens eligibility checks missing | Incompatible pairing rejected | No eligibility logic | Open | Developer | TBD |
| LENS-004 | D | Online unsupported Rx not blocked | Blocked with referral | Configurator allows any Rx | Open | Developer | TBD |
| POS-005 | E | UPI failure after order creation | Order remains unpaid | Not tested; risk of false confirmation | Open | Developer | TBD |
| POS-012 | E | Concurrent refunds not prevented | No double refund | Not tested; risk of double refund | Open | Developer | TBD |
| ORD-007 | F | Lab QC workflow missing | QC failure blocks delivery | No QC workflow exists | Open | Developer | TBD |
| FIN-011 | I | Month-end closing not implemented | Totals agree with source | No closing workflow | Open | Developer | TBD |
| FIN-012 | I | Closed-period editing not restricted | Restricted + audit logged | No period locking | Open | Developer | TBD |
| RBAC-001 | J | Cashier can change lens cost | Access denied | Not tested; risk of unauthorized edit | Open | Developer | TBD |
| RBAC-005 | J | Deactivated employee can login | Access denied | Not tested; risk of unauthorized access | Open | Developer | TBD |
| RBAC-010 | J | Direct API access not blocked | Server-side authorization | Not tested; risk of API abuse | Open | Developer | TBD |
| WEB-007 | K | Website payment failure recovery | Recovery without duplicate | Not tested; risk of duplicate payment | Open | Developer | TBD |
| WEB-010 | K | Prescription URL access control | Access denied for unauthorized | Not tested; risk of data exposure | Open | Developer | TBD |
| SYS-004 | L | Backup/restore not tested | Complete recovery | Not tested; risk of data loss | Open | Developer | TBD |
| SYS-006 | L | Failed migration rollback | Safe rollback | Not tested; risk of schema corruption | Open | Developer | TBD |

---

## High Issues (Workflow Blocked)

| ID | Module | Issue | Expected | Actual | Status | Assigned |
|----|--------|-------|----------|--------|--------|----------|
| CRM-004 | A | Family member management missing | Add family + sharing permissions | No UI in ERP or portal | Open | Developer |
| CRM-006 | A | Consent recording in ERP missing | Staff can record consent | Only set on website signup | Open | Developer |
| CRM-007 | A | Customer branch attribution missing | branch_id set on create | branch_id is null | Open | Developer |
| RX-002 | B | OCR not functional | OCR returns values | HF model not enabled + no credits | Open | Developer |
| RX-006 | B | VA not copied to prescription | VA transferred from exam | od_va_dist/near always null | Open | Developer |
| RX-008 | B | Previous-Rx comparison missing | Diff vs earlier Rx | Not implemented | Open | Developer |
| INV-003 | C | Stock transfer not atomic | Atomic dispatch + receipt | Two independent manual steps | Open | Developer |
| INV-004 | C | Reserved stock concept missing | Hold/reserve quantity | No reserved column | Open | Developer |
| LENS-001 | D | Good/Better/Best/Premium tiers missing | Tiered recommendations | No tier naming | Open | Developer |
| LENS-003 | D | Supplier/brand on lens missing | Captured on create | No field in UI | Open | Developer |
| LENS-005 | D | ADD not entered online | ADD captured | No ADD field in web RxForm | Open | Developer |
| POS-002 | E | Cancel order incomplete | Status cancelled + stock returned | Cancel button did not complete | Open | Developer |
| POS-013 | E | Return against old invoice missing | Correct references | Not tested | Open | Developer |
| POS-016 | E | Intra/inter-state GST not verified | Correct CGST/SGST or IGST | Full split not verified | Open | Developer |
| ORD-005 | F | Order delay notification missing | Delay highlighted + notified | Not tested | Open | Developer |
| SVC-001 | G | Repair verification policy missing | Follow defined policy | Not tested | Open | Developer |
| PUR-001 | H | PO approval missing | Approval history recorded | Not tested | Open | Developer |
| FIN-003 | I | UPI settlement reconciliation missing | Fees/refunds/net accounted | Not tested | Open | Developer |
| FIN-010 | I | Refund credit note treatment missing | Correct reversal | Not tested | Open | Developer |
| RBAC-002 | J | Large discount approval missing | Approval required | Not tested | Open | Developer |

---

## Medium Issues (Workaround Exists)

| ID | Module | Issue | Status | Assigned |
|----|--------|-------|--------|----------|
| CRM-003 | A | Profile tab identical to Overview | Open | Developer |
| CRM-008 | A | Client-side only search | Open | Developer |
| CRM-009 | A | No customer transfer UI | Open | Developer |
| LENS-006 | D | No index comparison | Open | Developer |
| LENS-012 | D | Supplier price change not handled | Open | Developer |
| POS-010 | E | Quote-price policy not enforced | Open | Developer |
| POS-011 | E | Reprint not implemented | Open | Developer |
| POS-014 | E | Customer ledger not implemented | Open | Developer |
| SVC-005 | G | Repair rejection closure missing | Open | Developer |
| PUR-006 | H | Duplicate invoice not blocked | Open | Developer |
| FIN-009 | I | Wrong branch expense correction missing | Open | Developer |
| WEB-012 | K | Broken image handling missing | Open | Developer |

---

## Low Issues (Cosmetic)

| ID | Module | Issue | Status | Assigned |
|----|--------|-------|--------|----------|
| CRM-003 | A | Profile tab redundant | Open | Developer |
| LENS-015 | D | Lens comparison UI missing | Open | Developer |
| WEB-011 | K | Draft content visibility check missing | Open | Developer |

---

## Fixed Issues (Verified)

| ID | Module | Issue | Fix Applied | Verified | Date |
|----|--------|-------|-------------|----------|------|
| CRM-005 | A | Opt-out never read | birthday-greeting + abandoned-cart filter on whatsapp_opt_in | ✅ | 2026-11-20 |
| APT-001 | B | Booking drawer dead | Wired ApptsView into appointments page | ✅ | 2026-11-20 |
| RX-001 | B | Book button dead | Same as APT-001 | ✅ | 2026-11-20 |
| POS-001 | E | Place order crash | try/catch + idempotency_key | ✅ | 2026-11-20 |
| INV-001 | C | Purchase invoices no stock | receiveStock function with atomic claim | ✅ | 2026-11-20 |
| RX-004 | B | Axis silently clamped | Validate RAW axis before fixAxis | ✅ | 2026-11-20 |

---

## Issue Statistics

### By Module
| Module | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| A. Customer & CRM | 2 | 4 | 3 | 1 | 10 |
| B. Eye exam & Rx | 3 | 3 | 0 | 0 | 6 |
| C. Frame & inventory | 1 | 2 | 0 | 0 | 3 |
| D. Lens catalogue | 2 | 3 | 2 | 1 | 8 |
| E. POS & payments | 2 | 4 | 4 | 0 | 10 |
| F. Orders & lab | 1 | 1 | 0 | 0 | 2 |
| G. Repairs & warranty | 0 | 1 | 1 | 0 | 2 |
| H. Purchasing | 0 | 1 | 1 | 0 | 2 |
| I. Finance & GST | 2 | 2 | 1 | 0 | 5 |
| J. Staff & permissions | 3 | 1 | 0 | 0 | 4 |
| K. Website & portal | 2 | 1 | 1 | 1 | 5 |
| L. System & reliability | 2 | 0 | 0 | 0 | 2 |
| **Total** | **20** | **24** | **13** | **3** | **59** |

### By Severity
| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | 20 | 34% |
| High | 24 | 41% |
| Medium | 13 | 22% |
| Low | 3 | 5% |
| **Total** | **60** | **100%** |

### By Status
| Status | Count | Percentage |
|--------|-------|------------|
| Open | 54 | 90% |
| Fixed | 6 | 10% |
| **Total** | **60** | **100%** |

---

## Priority Actions

### Immediate (This Week)
1. Add unique constraints on customers.phone and customers.email
2. Implement prescription approval gate
3. Add expired prescription enforcement at POS
4. Implement stock reservation concept
5. Add lens eligibility checks

### Short-term (Next 2 Weeks)
1. Implement physical stock count workflow
2. Add split payment support
3. Implement refund workflow with credit notes
4. Add lab QC workflow
5. Implement month-end closing

### Medium-term (Next Month)
1. Complete RBAC enforcement
2. Add audit logging for all critical operations
3. Implement backup/restore testing
4. Add website-ERP sync verification
5. Complete security penetration testing

---

**Report Generated:** 21 November 2026
**Next Review:** Weekly until all Critical issues resolved
