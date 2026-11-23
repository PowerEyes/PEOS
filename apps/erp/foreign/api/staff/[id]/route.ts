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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const { data, error } = await ctx.sb.from("staff_profiles").select("*").eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id).single();
  if (error || !data) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Staff member not found", recovery: "Check the staff ID" } }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });
  if (ctx.profile.role !== "owner" && ctx.profile.role !== "admin") {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Only owners/admins can edit staff", recovery: "Contact your administrator" } }, { status: 403 });
  }

  const body = await request.json();
  const { data, error } = await ctx.sb.from("staff_profiles").update(body).eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id).select().single();
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });
  if (ctx.profile.role !== "owner") {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Only owners can deactivate staff", recovery: "Contact the owner" } }, { status: 403 });
  }

  const { error } = await ctx.sb.from("staff_profiles").update({ is_active: false, deactivated_at: new Date().toISOString() }).eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id);
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ success: true, message: "Staff member deactivated" });
}