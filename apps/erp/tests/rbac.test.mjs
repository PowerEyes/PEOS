import test from "node:test"; import assert from "node:assert/strict";
import { routeAllowed } from "../src/lib/rbac.ts";
test("unknown/null role denied everywhere", () => { assert.equal(routeAllowed(null, "/"), false); assert.equal(routeAllowed("hacker", "/sales"), false); });
test("staff can use operations, not admin/finance", () => {
  for (const p of ["/", "/sales", "/customers", "/repairs", "/transfers", "/inventory"]) assert.equal(routeAllowed("staff", p), true, p);
  for (const p of ["/staff", "/settings", "/website/coupons", "/finance", "/finance/gstr1", "/crm", "/purchase-invoices"]) assert.equal(routeAllowed("staff", p), false, p);
});
test("branch manager: finance yes, staff/settings no", () => {
  assert.equal(routeAllowed("branch_manager", "/finance/reports", ["finance_view"]), true); assert.equal(routeAllowed("branch_manager", "/staff"), false); assert.equal(routeAllowed("branch_manager", "/settings"), false);
});
test("owner/admin everywhere; prefix tricks do not bypass", () => {
  for (const r of ["owner", "admin"]) for (const p of ["/staff", "/finance", "/settings/x"]) assert.equal(routeAllowed(r, p), true);
  assert.equal(routeAllowed("staff", "/staffing"), true); // different route, not /staff
  assert.equal(routeAllowed("staff", "/staff/anything"), false);
});
test("configurable permissions open finance for the roles an admin allows", () => {
  assert.equal(routeAllowed("staff", "/finance", ["finance_view"]), true);
  assert.equal(routeAllowed("staff", "/finance", ["expenses"]), false);
  assert.equal(routeAllowed("branch_manager", "/purchase-invoices", []), false);
  assert.equal(routeAllowed("branch_manager", "/purchase-invoices", ["finance_view"]), true);
  assert.equal(routeAllowed("admin", "/finance", []), true);
  assert.equal(routeAllowed("staff", "/staff", ["finance_view"]), false);
});
test("specialist roles are staff-tier: branch-bound, never admin/manager screens", () => {
  const specialists = ["optometrist", "receptionist", "sales_executive", "cashier", "inventory_manager", "lab_technician", "accountant"];
  for (const r of specialists) {
    for (const p of ["/", "/sales", "/customers", "/workshop", "/inventory", "/appointments"]) assert.equal(routeAllowed(r, p), true, `${r} ${p}`);
    for (const p of ["/staff", "/settings", "/website", "/reports", "/crm", "/subscription", "/company"]) assert.equal(routeAllowed(r, p), false, `${r} ${p}`);
    assert.equal(routeAllowed(r, "/finance"), false, `${r} /finance needs finance_view`);
  }
});
test("specialist roles reach their own modules through grants, not role names", () => {
  assert.equal(routeAllowed("accountant", "/finance", ["finance_view"]), true);
  assert.equal(routeAllowed("accountant", "/finance/gstr1", ["finance_view"]), true);
  assert.equal(routeAllowed("accountant", "/accountant-export", ["finance_view"]), true);
  assert.equal(routeAllowed("accountant", "/finance", []), false);
  assert.equal(routeAllowed("inventory_manager", "/stock-audits", ["stock_audit"]), true);
  assert.equal(routeAllowed("inventory_manager", "/stock-audits"), false);
  assert.equal(routeAllowed("inventory_manager", "/purchases", ["purchases_manage"]), true);
  assert.equal(routeAllowed("sales_executive", "/web-orders", ["web_orders"]), true);
  assert.equal(routeAllowed("cashier", "/finance", ["finance_view"]), true);
  assert.equal(routeAllowed("lab_technician", "/workshop"), true);
});
test("audit is owner/admin-only; branches are manager-tier, creation admin-only", () => {
  for (const r of ["owner", "admin"]) for (const p of ["/audit", "/branches", "/branches/xyz", "/branches/new"]) assert.equal(routeAllowed(r, p), true, `${r} ${p}`);
  assert.equal(routeAllowed("branch_manager", "/branches"), true);
  assert.equal(routeAllowed("branch_manager", "/branches/xyz"), true);
  assert.equal(routeAllowed("branch_manager", "/branches/new"), false, "branch creation stays owner/admin");
  assert.equal(routeAllowed("branch_manager", "/audit"), false, "audit rows are RLS owner/admin-only");
  const staffTier = ["staff", "accountant", "cashier", "receptionist", "inventory_manager", "sales_executive", "lab_technician", "optometrist"];
  for (const r of staffTier) {
    assert.equal(routeAllowed(r, "/branches"), false, `${r} /branches`);
    assert.equal(routeAllowed(r, "/audit"), false, `${r} /audit`);
  }
});
