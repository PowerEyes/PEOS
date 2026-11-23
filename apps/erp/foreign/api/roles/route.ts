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

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const { data, error } = await ctx.sb.from("roles").select("*, role_permissions(permission_id, granted, permissions(code, name, module))").eq("tenant_id", ctx.profile.tenant_id).order("name");
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { name, description, permissions } = body;
  if (!name) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Role name is required", recovery: "Provide a role name" } }, { status: 400 });

  const { data: role, error } = await ctx.sb.from("roles").insert({ tenant_id: ctx.profile.tenant_id, name, description: description || null, is_system: false }).select().single();
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });

  // Assign permissions
  if (permissions && Array.isArray(permissions)) {
    const rpInserts = permissions.map((p: { permission_id: string; granted: boolean }) => ({
      role_id: role.id, permission_id: p.permission_id, granted: p.granted ?? true,
    }));
    await ctx.sb.from("role_permissions").insert(rpInserts);
  }

  return NextResponse.json({ data: role }, { status: 201 });
}