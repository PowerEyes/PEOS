import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDriveBackup } from "@/lib/backup";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Without a configured secret the route is closed.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET, got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: orgs } = await supabaseAdmin().from("integration_secrets").select("org_id").eq("provider", "google_drive");
  const results: Record<string, string> = {};
  for (const o of orgs ?? []) { const r = await runDriveBackup(o.org_id, "cron"); results[o.org_id] = r.ok ? "ok" : r.error; }
  return NextResponse.json({ ran: Object.keys(results).length, results });
}
