import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { buildDocPdf } from "@/lib/doc-render";
import { DOCS, type DocType } from "@/lib/doclinks";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Staff preview/download of the exact PDF the customer receives. Uses the staff session, so RLS
// (organisation + branch scope) decides access; no link is consumed.
export async function GET(req: Request) {
  const u = new URL(req.url); const type = u.searchParams.get("type") as DocType; const id = u.searchParams.get("id") ?? "";
  if (!DOCS[type] || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const built = await buildDocPdf(sb, type, id);
  if (!built) return NextResponse.json({ error: "Not found or no access" }, { status: 404 });
  return new Response(built.pdf as any, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${built.filename}"`, "Cache-Control": "private, no-store" } });
}
