import { NextResponse } from "next/server";
import { adminCtx } from "@/lib/admin-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCode, emailFromIdToken, googleConfigured } from "@/lib/google-drive";
import { runDriveBackup } from "@/lib/backup";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: Request) {
  const u = new URL(req.url), back = (q: string) => { const r = NextResponse.redirect(new URL(`/settings/backup?${q}`, req.url)); r.cookies.delete("pe_gstate"); return r; };
  const a = await adminCtx();
  if (!a || !googleConfigured()) return back("err=forbidden");
  const cookie = req.headers.get("cookie")?.split(/;\s*/).find(c => c.startsWith("pe_gstate="))?.slice(10);
  if (!cookie || cookie !== u.searchParams.get("state")) return back("err=state");
  const code = u.searchParams.get("code");
  if (u.searchParams.get("error") || !code) return back("err=denied");
  try {
    const t = await exchangeCode(code);
    if (!t.refresh_token) return back("err=no_refresh");
    const { error } = await supabaseAdmin().from("integration_secrets").upsert({ org_id: a.orgId, provider: "google_drive", secret: { refresh_token: t.refresh_token }, account_label: emailFromIdToken(t.id_token), connected_at: new Date().toISOString() }, { onConflict: "org_id,provider" });
    if (error) return back("err=save");
    void runDriveBackup(a.orgId, "manual"); // first backup right away; result appears in history
    return back("connected=1");
  } catch { return back("err=google"); }
}
