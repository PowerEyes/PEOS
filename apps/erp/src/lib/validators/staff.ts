export interface StaffInput {
  full_name: string;
  email: string;
  role: string;
  branch_id: string;
}

const VALID_ROLES = ["owner", "admin", "branch_manager", "staff", "optometrist", "sales_executive", "cashier", "inventory_manager", "lab_technician", "accountant", "receptionist"];

export function validateStaff(input: StaffInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.full_name || input.full_name.length < 2) errors.push("Name must be at least 2 characters");
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push("Valid email is required");
  if (!VALID_ROLES.includes(input.role)) errors.push(`Invalid role: ${input.role}`);
  if (!input.branch_id) errors.push("Branch is required");
  return { valid: errors.length === 0, errors };
}