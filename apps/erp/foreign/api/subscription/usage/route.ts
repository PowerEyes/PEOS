import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function getAuthContext(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const sb = getSupabase();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role").eq("user_id", user.id).single();
  if (!profile) return null;
  return { user, profile, sb };
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const tenantId = ctx.profile.tenant_id;

  const [branches, staff, customers, products, sales] = await Promise.all([
    ctx.sb.from("branches").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    ctx.sb.from("staff_profiles").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    ctx.sb.from("customers").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    ctx.sb.from("products").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    ctx.sb.from("sales").select("id", { count: "exact" }).eq("tenant_id", tenantId),
  ]);

  const { data: sub } = await ctx.sb.from("subscriptions").select("plan:subscription_plans(branch_limit, employee_limit)").eq("tenant_id", tenantId).single();

  return NextResponse.json({
    data: {
      usage: {
        branches: branches.count || 0,
        employees: staff.count || 0,
        customers: customers.count || 0,
        products: products.count || 0,
        sales: sales.count || 0,
      },
      limits: {
        branches: (sub?.plan as any)?.branch_limit || null,
        employees: (sub?.plan as any)?.employee_limit || null,
      },
    },
  });
}