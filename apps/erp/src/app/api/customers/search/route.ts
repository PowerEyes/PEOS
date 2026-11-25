import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Search runs as the signed-in user (anon key + their JWT) so PostgREST
// applies RLS — results are scoped to their organization the same way as
// every other query in the app, with no manual tenant filter to drift.
function getClient(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const sb = getClient(token);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Not authenticated", recovery: "Log in again" } }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  let query = sb.from("customers").select("id, full_name, phone, vision_id, customer_code");
  if (q) {
    // Strip ilike wildcards and the characters PostgREST uses to parse or= expressions
    const term = q.replace(/[%_(),\\"]/g, "");
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,vision_id.ilike.%${term}%,customer_code.ilike.%${term}%`);
  }
  const { data, error: searchError } = await query.order("full_name").limit(q ? 10 : 6);
  if (searchError) return NextResponse.json({ error: { code: "UNKNOWN", message: searchError.message, recovery: "Try again" } }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
