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
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id, role, id").eq("user_id", user.id).single();
  if (!profile) return null;
  return { user, profile, sb };
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const { data, error } = await ctx.sb.from("leave_requests").select("*, staff:staff_profiles(full_name, role)").eq("tenant_id", ctx.profile.tenant_id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { member_id, leave_type, from_date, to_date, reason } = body;
  if (!member_id || !leave_type || !from_date || !to_date) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "member_id, leave_type, from_date, to_date required", recovery: "Fill in all required fields" } }, { status: 400 });
  }

  const { data, error } = await ctx.sb.from("leave_requests").insert({
    tenant_id: ctx.profile.tenant_id, member_id, leave_type, from_date, to_date, reason: reason || null, status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });
  if (ctx.profile.role !== "owner" && ctx.profile.role !== "admin" && ctx.profile.role !== "branch_manager") {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Not authorized to approve leave", recovery: "Contact your manager" } }, { status: 403 });
  }

  const body = await request.json();
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "id and status required", recovery: "Provide leave ID and status" } }, { status: 400 });

  const { data, error } = await ctx.sb.from("leave_requests").update({ status, approved_by: ctx.user.id }).eq("id", id).eq("tenant_id", ctx.profile.tenant_id).select().single();
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data });
}