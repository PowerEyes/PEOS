import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  code: z.string().min(1, "Branch code is required").max(8, "Branch code max 8 characters"),
  address: z.string().optional(),
  phone: z.string().regex(/^[+\d\s-]{7,15}$/, "Invalid phone number").optional().or(z.literal("")),
  gst_state: z.string().optional(),
  manager_email: z.string().email("Invalid email").optional().or(z.literal("")),
});

export const staffSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  role: z.enum(["owner", "admin", "branch_manager", "staff", "optometrist", "sales_executive", "cashier", "inventory_manager", "lab_technician", "accountant", "receptionist"]),
  branch_id: z.string().uuid("Branch is required"),
  additional_branches: z.array(z.string().uuid()).optional(),
});

export const subscriptionSchema = z.object({
  plan_id: z.string().uuid("Plan is required"),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type StaffInput = z.infer<typeof staffSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;