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
  if (!profile || profile.role !== "owner") return null;
  return { user, profile, sb };
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { plan_id, billing_cycle } = body;
  if (!plan_id) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "plan_id is required", recovery: "Select a plan" } }, { status: 400 });

  const { data: newPlan } = await ctx.sb.from("subscription_plans").select("*").eq("id", plan_id).single();
  if (!newPlan) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Plan not found", recovery: "Select a valid plan" } }, { status: 404 });

  const { data: currentSub } = await ctx.sb.from("subscriptions").select("*").eq("tenant_id", ctx.profile.tenant_id).single();

  if (currentSub) {
    // Update existing subscription
    const { data, error } = await ctx.sb.from("subscriptions").update({
      plan_id, billing_cycle: billing_cycle || currentSub.billing_cycle,
      status: "active", updated_at: new Date().toISOString(),
    }).eq("id", currentSub.id).select().single();
    if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
    return NextResponse.json({ data, message: `Upgraded to ${newPlan.name}` });
  } else {
    // Create new subscription
    const { data, error } = await ctx.sb.from("subscriptions").insert({
      tenant_id: ctx.profile.tenant_id, plan_id, status: "active",
      billing_cycle: billing_cycle || "monthly", current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
    return NextResponse.json({ data, message: `Subscribed to ${newPlan.name}` }, { status: 201 });
  }
}