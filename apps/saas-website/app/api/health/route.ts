import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  // Health is server-only: check Supabase reachability through a small,
  // known-present table instead of an RPC that may not exist in every env.
  const { error } = await serviceDb().from("billing_plans").select("code").limit(1);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
