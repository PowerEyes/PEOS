import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
const cut = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const db = supabaseAdmin();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed } = await db.rpc("rate_limit_hit", { p_key: `log-error:${ip}`, p_limit: 30, p_window_secs: 600 });
  if (allowed === false) return NextResponse.json({ ok: false }, { status: 429 });
  let orgId: string | null = null, userId: string | null = null;
  try { const sb = supabaseServer(); const { data: { user } } = await sb.auth.getUser(); if (user) { userId = user.id; const { data: p } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle(); orgId = p?.org_id ?? null; } } catch { /* anonymous */ }
  await db.from("error_logs").insert({ org_id: orgId, user_id: userId, app: "erp", message: cut(body.message, 500)!, stack: cut(body.stack, 3000), digest: cut(body.digest, 80), path: cut(body.path, 200) });
  return NextResponse.json({ ok: true });
}
