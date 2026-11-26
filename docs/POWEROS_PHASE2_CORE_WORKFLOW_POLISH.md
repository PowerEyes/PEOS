# PowerOS Phase 2 — Core Daily Workflow Pages

## Scope
Polish and add operational KPI summaries to the high-frequency workflow pages: Dashboard, Customers, Customer Workspace (Customer 360), Eye Examinations, Prescriptions, POS, Sales, Orders, Inventory and Repairs.

## Implemented in this source pass
- Added `ModuleKpiGrid`, a responsive shared KPI summary component with semantic section labeling, consistent metric cards, tone states, compact values and optional detail text.
- Added `DataLoadError`, a reusable retryable server-data failure state that refreshes the current route and does not silently show empty records after a query failure.
- Customers: customer count, added-this-month count, active count and live search-result count.
- Customer 360 workspace: loaded prescription/order/repair counts and order-value summary. Metrics show `Loading…` until each related query resolves, avoiding initial zero-value misinformation.
- Eye examination/Consultations: loaded exam count, current-month exam count, distinct examiner count and data-load state. Existing examination listing error remains visible.
- Prescriptions: record count, active, expiring-soon and expired counts, with attention tones.
- POS/Sales (the `/sales/pos` route reuses Sales): order count, order value, unpaid outstanding and quotations.
- Inventory: product count, total stock units in the current branch scope, low-stock products and out-of-stock products.
- Repairs: total repairs, pending/in-progress count, ready count and overdue count.
- Website order fulfilment: active fulfilment count/value, payment-mismatch alert count and ready-to-dispatch count.
- Added explicit query-error fallback states for Customers, Prescriptions, Sales, Inventory, Repairs and Website Order Fulfilment. Retry triggers route refresh.

## KPI definitions / limitations
- Counts reflect records returned by the page's existing queries and scope. Where the page limits data (for example, recent records), labels/details state that the metric represents loaded records.
- Customer list remains capped by its existing query limit; KPI counts are not a global database aggregate.
- Sales and quotations KPIs use the page's loaded sales records (existing query cap and branch scope remain).
- Inventory KPIs use the existing products/stock payload and branch scope; total stock units sum returned stock rows.
- Customer 360 totals are derived from the customer-specific order history loaded by its existing browser queries. Query failures now show `Unavailable`/error feedback rather than being presented as empty history. The total order value is not a receivable balance.
- The eye-examination KPI data uses the existing branch-scoped examination query (recent 100 records).
- KPI summaries are informational. No underlying business calculations, schema, workflow statuses, payment logic, permissions or database write actions were changed in this pass.

## Verification performed
- TypeScript/TSX syntax transpilation: 14 modified/new files passed.
- ERP test suite: 52 passed, 0 failed.
- Full typecheck: not run (dependencies are not installed in this workspace).
- Next.js production build: not run (dependencies are not installed in this workspace).
- Browser UI/visual testing, responsive screenshots and real DB integration: not run (no browser/deployment credentials or running database in this workspace).

## Production status
**Implementation pass complete; production acceptance remains pending.** Do not treat this phase as production-ready sign-off until typecheck/build, browser review, responsive validation, tenant/branch-role testing and real data verification are completed.
