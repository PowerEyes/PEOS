// Branch validation using Zod (if available) or manual validation
export interface BranchInput {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  gst_state?: string;
  manager_email?: string;
}

export function validateBranch(input: BranchInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.name || input.name.length < 2) errors.push("Branch name must be at least 2 characters");
  if (!input.code || input.code.length > 8) errors.push("Branch code is required (max 8 characters)");
  if (input.phone && !/^[+\d\s-]{7,15}$/.test(input.phone)) errors.push("Invalid phone number");
  return { valid: errors.length === 0, errors };
}