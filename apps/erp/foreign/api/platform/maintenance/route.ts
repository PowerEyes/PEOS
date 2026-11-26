import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function GET() {
  const sb = getSupabase();
  // Store maintenance mode in a simple key-value or env
  // For now, check if there's an active maintenance announcement
  const { data } = await sb.from("announcements").select("*").eq("title", "__MAINTENANCE_MODE__").eq("is_active", true).single();
  return NextResponse.json({ maintenance_mode: !!data, message: data?.body || null });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  const body = await request.json();
  const { enabled, message } = body;

  // Remove existing maintenance announcement
  await sb.from("announcements").delete().eq("title", "__MAINTENANCE_MODE__");

  if (enabled) {
    await sb.from("announcements").insert({ title: "__MAINTENANCE_MODE__", body: message || "Under maintenance", target: "all", is_active: true });
  }

  return NextResponse.json({ maintenance_mode: enabled, message: message || null });
}