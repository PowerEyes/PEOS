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
  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) return null;
  return { user, profile, sb };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const { data, error } = await ctx.sb.from("roles").select("*, role_permissions(permission_id, granted, permissions(code, name, module))").eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id).single();
  if (error || !data) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Role not found", recovery: "Check the role ID" } }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { name, description, permissions } = body;

  const { data, error } = await ctx.sb.from("roles").update({ name, description }).eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id).select().single();
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });

  if (permissions && Array.isArray(permissions)) {
    await ctx.sb.from("role_permissions").delete().eq("role_id", params.id);
    const inserts = permissions.map((p: { permission_id: string; granted: boolean }) => ({
      role_id: params.id, permission_id: p.permission_id, granted: p.granted ?? true,
    }));
    await ctx.sb.from("role_permissions").insert(inserts);
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  // Check if role is system role
  const { data: role } = await ctx.sb.from("roles").select("is_system").eq("id", params.id).single();
  if (role?.is_system) {
    return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Cannot delete system roles", recovery: "System roles cannot be removed" } }, { status: 403 });
  }

  const { error } = await ctx.sb.from("roles").delete().eq("id", params.id).eq("tenant_id", ctx.profile.tenant_id);
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ success: true, message: "Role deleted" });
}