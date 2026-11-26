import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export interface UsageStats {
  branches: number;
  employees: number;
  customers: number;
  products: number;
  storage_mb: number;
}

export async function getUsage(tenantId: string): Promise<UsageStats> {
  const [branches, staff, customers, products] = await Promise.all([
    sb.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    sb.from("staff_profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    sb.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    sb.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return {
    branches: branches.count || 0,
    employees: staff.count || 0,
    customers: customers.count || 0,
    products: products.count || 0,
    storage_mb: 0, // TODO: calculate from Supabase storage
  };
}

export async function checkUsageLimit(tenantId: string, resource: "branches" | "employees" | "customers" | "products"): Promise<{ allowed: boolean; current: number; limit: number }> {
  const usage = await getUsage(tenantId);
  const { data: sub } = await sb.from("subscriptions").select("plan:subscription_plans(branch_limit, employee_limit)").eq("tenant_id", tenantId).single();

  const plan = sub?.plan as any;
  const limits: Record<string, number> = {
    branches: plan?.branch_limit || 1,
    employees: plan?.employee_limit || 5,
    customers: 1000,
    products: 10000,
  };

  const current = usage[resource];
  const limit = limits[resource];
  return { allowed: current < limit, current, limit };
}