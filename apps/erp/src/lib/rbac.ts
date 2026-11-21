// Single source of truth for role → route access. The database (RLS + RPCs) is the real gate;
// this only stops direct-URL navigation to screens the role can never use.
export type Role = "owner" | "admin" | "branch_manager" | "staff";
export const ROLES: Role[] = ["owner", "admin", "branch_manager", "staff"];
const ADMIN: Role[] = ["owner", "admin"];
const MANAGER: Role[] = ["owner", "admin", "branch_manager"];

// longest matching prefix wins
const RULES: [string, Role[]][] = [
  ["/staff", ADMIN], ["/settings", ADMIN], ["/website", ADMIN],
  ["/reports", MANAGER], ["/crm", MANAGER],
  ["/print/buying-list", MANAGER],
];
// Routes gated by a configurable permission (Staff → Permissions). Owners/admins always pass.
const PERM_ROUTES: [string, string][] = [["/finance", "finance_view"], ["/purchase-invoices", "finance_view"]];
export const PERMISSIONS = [
  { key: "finance_view", label: "View finance, cashbook & purchase invoices" },
  { key: "expenses", label: "Record expenses" },
  { key: "day_closing", label: "Close the day (cash reconciliation)" },
  { key: "catalogue_edit", label: "Edit products, brands, lenses & suppliers" },
] as const;
export function routeAllowed(role: string | null | undefined, path: string, perms: string[] = []): boolean {
  if (!role || !ROLES.includes(role as Role)) return false;
  const pr = PERM_ROUTES.find(([p]) => path === p || path.startsWith(p + "/"));
  if (pr && !isAdminRole(role) && !perms.includes(pr[1])) return false;
  const hit = RULES.filter(([p]) => path === p || path.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return !hit || hit[1].includes(role as Role);
}
export const isAdminRole = (r?: string | null) => r === "owner" || r === "admin";
export const isManagerRole = (r?: string | null) => isAdminRole(r) || r === "branch_manager";
