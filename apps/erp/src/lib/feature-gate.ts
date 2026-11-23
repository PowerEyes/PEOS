import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export type Feature =
  | "inventory"
  | "pos"
  | "prescriptions"
  | "lab_management"
  | "lpims"
  | "finance"
  | "multi_branch_reports"
  | "api_integrations"
  | "priority_support"
  | "advanced_lab"
  | "advanced_finance";

const PLAN_FEATURES: Record<string, Feature[]> = {
  starter: ["inventory", "pos", "prescriptions", "lab_management", "finance"],
  growth: ["inventory", "pos", "prescriptions", "lab_management", "lpims", "finance", "multi_branch_reports", "api_integrations"],
  enterprise: ["inventory", "pos", "prescriptions", "lab_management", "lpims", "finance", "multi_branch_reports", "api_integrations", "priority_support", "advanced_lab", "advanced_finance"],
};

export async function hasFeature(tenantId: string, feature: Feature): Promise<boolean> {
  const { data: sub } = await sb.from("subscriptions").select("plan:subscription_plans(name, slug)").eq("tenant_id", tenantId).single();
  const planSlug = (sub?.plan as any)?.slug || "starter";
  const features = PLAN_FEATURES[planSlug] || PLAN_FEATURES.starter;
  return features.includes(feature);
}

export async function checkBranchLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { data: sub } = await sb.from("subscriptions").select("plan:subscription_plans(branch_limit)").eq("tenant_id", tenantId).single();
  const { data: branches } = await sb.from("branches").select("id").eq("tenant_id", tenantId);
  const limit = (sub?.plan as any)?.branch_limit || 1;
  const current = branches?.length || 0;
  return { allowed: current < limit, current, limit };
}

export async function checkEmployeeLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { data: sub } = await sb.from("subscriptions").select("plan:subscription_plans(employee_limit)").eq("tenant_id", tenantId).single();
  const { data: staff } = await sb.from("staff_profiles").select("id").eq("tenant_id", tenantId);
  const limit = (sub?.plan as any)?.employee_limit || 5;
  const current = staff?.length || 0;
  return { allowed: current < limit, current, limit };
}