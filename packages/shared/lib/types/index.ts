/**
 * PowerOS SaaS Shared Types
 * Used across SaaS Website (:3003), SaaS Platform (:3002), and PowerOS ERP (:3001)
 */

export type RoleKey =
  | "owner"
  | "admin"
  | "branch_manager"
  | "staff"
  | "optometrist"
  | "sales_executive"
  | "cashier"
  | "inventory_manager"
  | "lab_technician"
  | "accountant"
  | "receptionist";

export type PlatformRole = "super_admin" | "support" | "billing" | "read_only";

export type OrgStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export type PlanTier = "starter" | "growth" | "enterprise";

export type PermissionKey =
  | "finance_view"
  | "expenses"
  | "day_closing"
  | "catalogue_edit"
  | "reports_view"
  | "crm_manage"
  | "discount_override"
  | "stock_adjust"
  | "purchases_manage"
  | "stock_audit"
  | "transfers_approve"
  | "web_orders"
  | "credit_notes.issue";

export type ProductKind = "frame" | "sunglass" | "contact_lens" | "accessory";
export type Gender = "men" | "women" | "unisex" | "kids";

export interface PlatformUser {
  user_id: string;
  email: string;
  full_name?: string;
  role: PlatformRole;
  is_active: boolean;
  created_at: string;
}

export interface PlatformInvitation {
  id: string;
  email: string;
  role: PlatformRole;
  token: string;
  invited_by?: string;
  invited_by_name?: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name?: string;
  subdomain?: string;
  business_email?: string;
  business_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  currency: string;
  timezone: string;
  financial_year_start_month: number;
  gstin?: string;
  pan?: string;
  status: OrgStatus;
  plan: PlanTier;
  trial_ends_at?: string;
  subscription_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: RoleKey;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_branches: number;
  max_customers: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface OrganizationSubscription {
  id: string;
  org_id: string;
  plan_id: PlanTier;
  status: OrgStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  razorpay_subscription_id?: string;
  razorpay_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrgSetting {
  id: string;
  org_id: string;
  key: string;
  value?: string;
  updated_at: string;
}

export interface PlatformAuditLog {
  id: number;
  user_id?: string;
  action: string;
  target_type: "organisation" | "user" | "subscription" | "invitation" | "settings";
  target_id?: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
}

// Customer types (shared between ERP and SaaS)
export interface Customer {
  id: string;
  org_id: string;
  branch_id?: string;
  customer_code?: string;
  vision_id?: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  referred_by_doctor?: string;
  gender?: "male" | "female";
  dob?: string;
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  tags: string[];
  status: string;
  created_at: string;
}

// Product types
export interface Product {
  id: string;
  org_id: string;
  kind: ProductKind;
  sku?: string;
  barcode?: string;
  brand_id?: string;
  model: string;
  gender: Gender;
  mrp?: number;
  selling_price: number;
  tax_pct: number;
  power_eligible: boolean;
  status: string;
  hsn?: string;
  price_mode: string;
  visible_on_website: boolean;
  created_at: string;
}

// Sale types
export interface Sale {
  id: string;
  org_id: string;
  branch_id: string;
  kind: "order" | "quotation";
  customer_id: string;
  prescription_id?: string;
  status: string;
  payment_status: string;
  grand_total: number;
  paid_total: number;
  created_at: string;
  updated_at: string;
}

// Prescription types
export interface Prescription {
  id: string;
  org_id: string;
  customer_id: string;
  rx_code?: string;
  rx_date: string;
  valid_till?: string;
  rx_type: string;
  purpose: string;
  od_sph?: number;
  od_cyl?: number;
  od_axis?: number;
  od_add?: number;
  os_sph?: number;
  os_cyl?: number;
  os_axis?: number;
  os_add?: number;
  pd_far?: number;
  status: string;
  review_status: string;
  created_at: string;
}

// Helper types
export type PaginatedResponse<T> = {
  data: T[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};