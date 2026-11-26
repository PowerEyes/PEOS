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

  const { data, error } = await ctx.sb.from("branches").select("*").eq("tenant_id", ctx.profile.tenant_id).order("name");
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });
  if (ctx.profile.role !== "owner" && ctx.profile.role !== "admin") {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Only owners/admins can create branches", recovery: "Contact your administrator" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, code, address, phone, gst_state, is_default } = body;
  if (!name || !code) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "name and code are required", recovery: "Fill in all required fields" } }, { status: 400 });

  const { data, error } = await ctx.sb.from("branches").insert({
    tenant_id: ctx.profile.tenant_id, name, code, address: address || null, phone: phone || null,
    gst_state: gst_state || null, is_default: is_default || false, is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}