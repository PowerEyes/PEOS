import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function getPlatformAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const sb = getSupabase();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Check if user is a platform admin (stored in a separate table or env)
  const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS || "").split(",");
  if (!platformAdmins.includes(user.email || "")) return null;
  return { user, sb };
}

export async function GET(request: Request) {
  const ctx = await getPlatformAdmin(request);
  if (!ctx) return NextResponse.json({ error: { code: "PERMISSION_DENIED", message: "Platform admin access required", recovery: "Contact PowerOS support" } }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  let query = ctx.sb.from("tenants").select("*, subscription:subscriptions(status, plan:subscription_plans(name))").order("created_at", { ascending: false });
  if (status) query = query.eq("is_active", status === "active");
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}