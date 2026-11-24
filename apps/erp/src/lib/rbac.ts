// Single source of truth for role → route access. The database (RLS + RPCs) is the real gate;
// this only stops direct-URL navigation to screens the role can never use.
export type Role = "owner" | "admin" | "branch_manager" | "staff";
export const ROLES: Role[] = ["owner", "admin", "branch_manager", "staff"];
const ADMIN: Role[] = ["owner", "admin"];
const MANAGER: Role[] = ["owner", "admin", "branch_manager"];

// Specialised employee roles (profiles.role_key). For *route* reach they are
// staff-tier: branch-bound, never admin/manager screens — what distinguishes
// them is their permission grants (role_permissions), not their route list.
// Mirrors the profiles_role_key_chk allow-list in the database.
export const SPECIALIST_ROLES = [
  "optometrist", "sales_executive", "cashier",
  "inventory_manager", "lab_technician", "accountant", "receptionist",
] as const;

// Roles that can hold per-org permission grants (owner/admin bypass has_perm).
export const GRANTABLE_ROLES: string[] = ["branch_manager", "staff", ...SPECIALIST_ROLES];

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", branch_manager: "Branch manager", staff: "Staff",
  optometrist: "Optometrist", sales_executive: "Sales", cashier: "Cashier",
  inventory_manager: "Inventory", lab_technician: "Lab",
  accountant: "Accountant", receptionist: "Reception",
};

/** The route tier a role_key behaves as, or null when the key is unknown.
 *  Unknown keys deny (fail closed) — profiles_role_key_chk makes them
 *  impossible in practice, but a bad value must never widen access. */
export function routeTier(role?: string | null): Role | null {
  if (!role) return null;
  if (role === "owner" || role === "admin") return role;
  if (role === "branch_manager") return "branch_manager";
  if (role === "staff" || (SPECIALIST_ROLES as readonly string[]).includes(role)) return "staff";
  return null;
}

// longest matching prefix wins
const RULES: [string, Role[]][] = [
  ["/staff", ADMIN], ["/settings", ADMIN], ["/website", ADMIN],
  ["/company", ADMIN],
  ["/reports", MANAGER], ["/crm", MANAGER],
  ["/print/buying-list", MANAGER],
  ["/subscription", ADMIN],
];
// Routes gated by a configurable permission (Staff → Permissions). Owners/admins always pass.
const PERM_ROUTES: [string, string][] = [["/finance", "finance_view"], ["/purchase-invoices", "finance_view"], ["/reports", "reports_view"], ["/crm", "crm_manage"], ["/purchases", "purchases_manage"], ["/stock-audits", "stock_audit"], ["/accountant-export", "finance_view"], ["/web-orders", "web_orders"]];
export const PERMISSIONS = [
  { key: "finance_view", label: "View finance, cashbook & purchase invoices" },
  { key: "expenses", label: "Record expenses" },
  { key: "day_closing", label: "Close the day (cash reconciliation)" },
  { key: "catalogue_edit", label: "Edit products, brands, lenses & suppliers" },
  { key: "reports_view", label: "View reports" },
  { key: "crm_manage", label: "Manage CRM automation" },
  { key: "discount_override", label: "Override staff discount limits" },
  { key: "stock_adjust", label: "Adjust stock manually" },
  { key: "purchases_manage", label: "Create and receive purchase orders" },
  { key: "stock_audit", label: "Count stock and approve cycle counts" },
  { key: "transfers_approve", label: "Approve branch stock transfers" },
  { key: "web_orders", label: "Manage online order fulfilment" },
  { key: "credit_notes.issue", label: "Issue credit notes and refunds" },
] as const;
export function routeAllowed(role: string | null | undefined, path: string, perms: string[] = []): boolean {
  const tier = routeTier(role);
  if (!tier) return false;
  const pr = PERM_ROUTES.find(([p]) => path === p || path.startsWith(p + "/"));
  if (pr && !isAdminRole(role) && !perms.includes(pr[1])) return false;
  const hit = RULES.filter(([p]) => path === p || path.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return !hit || hit[1].includes(tier);
}
export const isAdminRole = (r?: string | null) => r === "owner" || r === "admin";
export const isManagerRole = (r?: string | null) => isAdminRole(r) || r === "branch_manager";
