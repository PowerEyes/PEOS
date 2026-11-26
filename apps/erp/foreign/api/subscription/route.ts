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

  const { data: sub } = await ctx.sb.from("subscriptions").select("*, plan:subscription_plans(*)").eq("tenant_id", ctx.profile.tenant_id).single();
  if (!sub) return NextResponse.json({ error: { code: "NOT_FOUND", message: "No subscription found", recovery: "Contact support to set up a plan" } }, { status: 404 });

  // Get usage
  const { data: branches } = await ctx.sb.from("branches").select("id").eq("tenant_id", ctx.profile.tenant_id);
  const { data: staff } = await ctx.sb.from("staff_profiles").select("id").eq("tenant_id", ctx.profile.tenant_id);

  const plan = sub.plan;
  const now = new Date();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const isExpired = periodEnd ? periodEnd < now : false;
  const isTrial = sub.status === "trial";
  const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const trialExpired = trialEnds ? trialEnds < now : false;

  return NextResponse.json({
    data: {
      subscription: sub,
      plan,
      status: sub.status,
      is_active: sub.status === "active",
      is_trial: isTrial,
      is_expired: isExpired || (isTrial && trialExpired),
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      usage: {
        branches: branches?.length || 0,
        branch_limit: plan?.branch_limit || null,
        employees: staff?.length || 0,
        employee_limit: plan?.employee_limit || null,
      },
    },
  });
}