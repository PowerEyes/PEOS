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
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id, role").eq("user_id", user.id).single();
  if (!profile) return null;
  return { user, profile, sb };
}

export async function GET(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";

  if (!q) {
    // Return first 6 customers when no search term
    const { data, error } = await ctx.sb
      .from("customers")
      .select("id, full_name, phone, vision_id, family_id")
      .eq("tenant_id", ctx.profile.tenant_id)
      .order("full_name")
      .limit(6);
    if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  // Search across all four fields with OR conditions
  const term = q.replace(/[%_]/g, ""); // Sanitize special characters
  const { data, error } = await ctx.sb
    .from("customers")
    .select("id, full_name, phone, vision_id, family_id")
    .eq("tenant_id", ctx.profile.tenant_id)
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,vision_id.ilike.%${term}%,family_id.ilike.%${term}%`)
    .limit(10);

  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}