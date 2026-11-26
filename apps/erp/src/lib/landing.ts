// Where each role lands after login. Only routes that exist; role-specific work screens are the existing modules.
export const LANDING: Record<string, string> = {
  owner: "/", admin: "/", branch_manager: "/",
  optometrist: "/consultations", receptionist: "/appointments", sales_executive: "/sales", cashier: "/sales",
  inventory_manager: "/inventory", lab_technician: "/workshop", accountant: "/finance",
};
export const landingFor = (role?: string | null) => (role && LANDING[role]) || "/";
