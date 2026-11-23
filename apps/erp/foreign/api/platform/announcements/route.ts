import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data, count: data?.length || 0 });
}

export async function POST(request: Request) {
  const sb = getSupabase();
  const body = await request.json();
  const { title, body: content, target, target_id } = body;
  if (!title || !content) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "title and body required", recovery: "Fill in all fields" } }, { status: 400 });

  const { data, error } = await sb.from("announcements").insert({ title, body: content, target: target || "all", target_id: target_id || null, is_active: true }).select().single();
  if (error) return NextResponse.json({ error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}