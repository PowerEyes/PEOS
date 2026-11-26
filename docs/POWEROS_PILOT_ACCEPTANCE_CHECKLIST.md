# PowerOS Real-Shop Pilot Acceptance Checklist

**Pilot duration:** Minimum 30 supervised days  
**Required roles:** Shop owner, branch manager, optometrist, receptionist, sales executive, cashier, inventory manager, lab technician and accountant.

## Organization and security
- [ ] Create two separate shop organizations with different domains.
- [ ] Create at least two branches per organization.
- [ ] Verify tenant A cannot read, search, export, update or delete tenant B data through UI, REST, RPC, storage or document URLs.
- [ ] Verify each role's permitted and forbidden actions using direct URL and direct API calls.
- [ ] Deactivate a staff account and verify access stops immediately.
- [ ] Verify branch switching changes data scope and cannot be forged by editing cookies.
- [ ] Verify platform support access requires an audited break-glass grant.

## Customer and clinical journey
- [ ] Register a new customer and verify permanent customer / Vision IDs.
- [ ] Attempt duplicate phone/email registrations, including family members sharing a phone; confirm the agreed business rule.
- [ ] Book, reschedule and cancel appointments.
- [ ] Record an eye examination and compare OD/OS values.
- [ ] Create a prescription, submit for optometrist approval, reject and correct one, then approve.
- [ ] Try to sell with pending, rejected and expired prescriptions; all must be blocked.
- [ ] Verify prescription history is append-only and changes are audited.
- [ ] Verify upload and access controls for prescription images.

## Sales, POS and payments
- [ ] Sell frame-only and accessory orders.
- [ ] Test cash, UPI, card and split-payment paths where implemented.
- [ ] Double-click Pay and submit the same request from two sessions.
- [ ] Disconnect the browser during payment and confirm recovery from the webhook.
- [ ] Test wrong signature, wrong amount, failed payment, replayed event and duplicate payment ID.
- [ ] Process partial refund, full refund, return and credit note.
- [ ] Reconcile invoice totals, payment ledger, cashbook and gateway settlement.
- [ ] Confirm public prescription-lens checkout remains blocked until approved-Rx fulfilment is released.

## Inventory and procurement
- [ ] Receive supplier goods against a PO and compare received quantity to stock movements.
- [ ] Receive partial quantities and verify pending quantities.
- [ ] Transfer stock between branches through request, approval, dispatch and receipt.
- [ ] Interrupt a transfer and verify in-transit stock is not silently lost.
- [ ] Run physical stock count, variance approval and adjustment.
- [ ] Test two cashiers selling the last unit concurrently.
- [ ] Record damaged, missing, returned and reserved stock.
- [ ] Verify product cost is hidden from unauthorized roles.

## Lab, QC, delivery, repairs and warranty
- [ ] Create a prescription order and verify lab job creation.
- [ ] Assign/reassign technician and inspect history.
- [ ] Receive lens and verify actual power against the approved Rx.
- [ ] Fail QC, create rework/remake and verify delivery is blocked until pass.
- [ ] Mark ready, notify customer and deliver.
- [ ] Open repair with and without original invoice.
- [ ] Test valid/expired warranty, spare-part consumption, photos and customer consent.

## Finance, GST and staff
- [ ] Reconcile daily sales with invoices.
- [ ] Reconcile cash drawer, UPI, card and bank settlements.
- [ ] Test intra-state CGST/SGST and inter-state IGST.
- [ ] Verify purchase ITC and supplier balances.
- [ ] Export GSTR-1 and reconcile with accountant's independent calculation.
- [ ] Verify closed-period transactions cannot be silently edited.
- [ ] Test attendance and leave workflows.
- [ ] Do not use payroll until its statutory calculation and payment workflow has been separately implemented and signed off.

## Website, portal and SaaS
- [ ] Verify public catalogue resolves the correct organization by domain.
- [ ] Verify draft pages and another tenant's pages are not visible.
- [ ] Place a frame/accessory website order and confirm exactly one ERP sale.
- [ ] Verify customer can access only their own orders, invoices and prescriptions.
- [ ] Verify consent opt-out prevents marketing messages.
- [ ] Test subscription trial, payment, renewal, cancellation, grace period and expiry.
- [ ] Verify plan limits and entitlements are enforced server-side.

## Reliability and recovery
- [ ] Run at least 5–10 concurrent staff sessions.
- [ ] Refresh during saves and simulate network loss during payment.
- [ ] Verify idempotency and safe retry for all money/stock mutations.
- [ ] Restore database backup to a separate environment.
- [ ] Verify prescription/document storage restore.
- [ ] Record recovery time and recovery point.
- [ ] Confirm health monitoring and support escalation.

## Daily pilot reconciliation
- [ ] Sales invoices = POS sales = finance sales report.
- [ ] Cash collected = cashbook / cashier close.
- [ ] UPI/card collected = gateway transactions and settlement report.
- [ ] Stock opening + receipts - sales - transfers +/- adjustments = closing stock.
- [ ] Every open lab job has an owner and next action.
- [ ] Every failed payment/refund has a reconciliation record.

## Sign-off
- [ ] Shop owner accepts daily operations.
- [ ] Optometrist accepts clinical workflow and prescription controls.
- [ ] Accountant accepts GST and financial reconciliation.
- [ ] Security owner accepts tenant/branch isolation and RBAC.
- [ ] Support owner accepts backup, restore and incident process.

Any cross-tenant data exposure, unapproved prescription sale, duplicate payment, unexplained stock movement or failed restore is an immediate pilot stop.
