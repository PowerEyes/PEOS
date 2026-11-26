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
  const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const branchId = url.searchParams.get("branch_id") || ctx.profile.branch_id;

  const { data, error } = await ctx.sb.from("attendance").select("*, staff:staff_profiles(full_name, role)").eq("branch_id", branchId).eq("date", date);
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const body = await request.json();
  const { member_id, branch_id, date, status, check_in, check_out, notes } = body;

  const { data, error } = await ctx.sb.from("attendance").upsert({
    tenant_id: ctx.profile.tenant_id, member_id, branch_id: branch_id || ctx.profile.branch_id,
    date: date || new Date().toISOString().split("T")[0], status: status || "present",
    check_in: check_in || null, check_out: check_out || null, notes: notes || null,
  }, { onConflict: "member_id,date" }).select().single();

  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}