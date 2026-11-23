import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export type Permission =
  | "branches.view" | "branches.create" | "branches.edit" | "branches.delete"
  | "staff.view" | "staff.invite" | "staff.edit" | "staff.deactivate"
  | "staff.permissions" | "staff.branches"
  | "roles.view" | "roles.create" | "roles.edit" | "roles.delete"
  | "customers.view" | "customers.create" | "customers.edit" | "customers.delete"
  | "sales.view" | "sales.create" | "sales.refund" | "sales.discount"
  | "inventory.view" | "inventory.edit" | "inventory.adjust" | "inventory.transfer"
  | "products.view" | "products.edit"
  | "appointments.view" | "appointments.create"
  | "finance.view" | "finance.reports" | "finance.gst" | "finance.credit_notes"
  | "prescriptions.view" | "prescriptions.create" | "prescriptions.approve"
  | "reports.view" | "reports.export"
  | "settings.view" | "settings.edit" | "settings.security"
  | "subscription.view" | "subscription.manage";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ["branches.view", "branches.create", "branches.edit", "branches.delete",
    "staff.view", "staff.invite", "staff.edit", "staff.deactivate", "staff.permissions", "staff.branches",
    "roles.view", "roles.create", "roles.edit", "roles.delete",
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "sales.view", "sales.create", "sales.refund", "sales.discount",
    "inventory.view", "inventory.edit", "inventory.adjust", "inventory.transfer",
    "finance.view", "finance.reports", "finance.gst", "finance.credit_notes",
    "prescriptions.view", "prescriptions.create", "prescriptions.approve",
    "reports.view", "reports.export",
    "settings.view", "settings.edit", "settings.security",
    "subscription.view", "subscription.manage"],
  admin: ["branches.view", "branches.create", "branches.edit",
    "staff.view", "staff.invite", "staff.edit", "staff.deactivate", "staff.permissions", "staff.branches",
    "roles.view", "roles.create", "roles.edit",
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "sales.view", "sales.create", "sales.refund", "sales.discount",
    "inventory.view", "inventory.edit", "inventory.adjust", "inventory.transfer",
    "finance.view", "finance.reports", "finance.gst", "finance.credit_notes",
    "prescriptions.view", "prescriptions.create", "prescriptions.approve",
    "reports.view", "reports.export",
    "settings.view", "settings.edit"],
  branch_manager: ["branches.view",
    "staff.view",
    "customers.view", "customers.create", "customers.edit",
    "sales.view", "sales.create", "sales.refund",
    "inventory.view", "inventory.edit", "inventory.adjust", "inventory.transfer",
    "finance.view",
    "prescriptions.view", "prescriptions.create",
    "reports.view", "reports.export",
    "settings.view"],
  optometrist: ["customers.view", "customers.create",
    "prescriptions.view", "prescriptions.create", "prescriptions.approve",
    "reports.view"],
  sales_executive: ["customers.view", "customers.create",
    "sales.view", "sales.create",
    "inventory.view",
    "prescriptions.view"],
  cashier: ["customers.view",
    "sales.view", "sales.create",
    "finance.view"],
  inventory_manager: ["inventory.view", "inventory.edit", "inventory.adjust", "inventory.transfer",
    "products.view", "products.edit"],
  lab_technician: ["prescriptions.view"],
  accountant: ["finance.view", "finance.reports", "finance.gst", "finance.credit_notes",
    "reports.view", "reports.export"],
  receptionist: ["customers.view", "customers.create",
    "appointments.view", "appointments.create"],
};

export async function hasPermission(userId: string, permission: Permission, branchId?: string): Promise<boolean> {
  const { data: profile } = await sb.from("staff_profiles").select("id, role, tenant_id, branch_id").eq("user_id", userId).single();
  if (!profile) return false;

  // Owner always has all permissions
  if (profile.role === "owner") return true;

  // Check role-based permissions
  const rolePerms = ROLE_PERMISSIONS[profile.role] || [];
  if (rolePerms.includes(permission)) {
    // Check branch scope if branchId provided
    if (branchId && profile.branch_id !== branchId && profile.role !== "admin") {
      // Check if user has access to this branch via branch_memberships
      const { data: membership } = await sb.from("branch_memberships").select("id").eq("member_id", profile.id).eq("branch_id", branchId).single();
      if (!membership) return false;
    }
    return true;
  }

  // Check individual permission overrides
  const { data: override } = await sb.from("member_permissions").select("granted").eq("member_id", profile.id).eq("permission_id", permission).single();
  if (override) return override.granted;

  return false;
}

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const { data: profile } = await sb.from("staff_profiles").select("id, role").eq("user_id", userId).single();
  if (!profile) return [];
  if (profile.role === "owner") return ROLE_PERMISSIONS.owner;
  return ROLE_PERMISSIONS[profile.role] || [];
}