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
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role, branch_id").eq("user_id", user.id).single();
  if (!profile) return null;
  return { user, profile, sb };
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branch_id");
  const role = url.searchParams.get("role");

  let query = ctx.sb.from("staff_profiles").select("*").eq("tenant_id", ctx.profile.tenant_id);
  if (branchId) query = query.eq("branch_id", branchId);
  if (role) query = query.eq("role", role);

  const { data, error } = await query.order("full_name");
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });
  if (ctx.profile.role !== "owner" && ctx.profile.role !== "admin") {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Only owners/admins can invite staff", recovery: "Contact your administrator" } }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name, role, branch_id, additional_branches } = body;
  if (!email || !full_name || !role || !branch_id) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "email, full_name, role, branch_id required", recovery: "Fill in all required fields" } }, { status: 400 });
  }

  // Create invitation
  const { data: invitation, error } = await ctx.sb.from("staff_invitations").insert({
    tenant_id: ctx.profile.tenant_id, branch_id, email, full_name, role,
    invited_by: ctx.user.id, status: "pending",
    additional_branches: additional_branches || [],
  }).select().single();

  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data: invitation, message: "Invitation sent" }, { status: 201 });
}