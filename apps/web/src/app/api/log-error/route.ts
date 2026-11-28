import { NextResponse } from "next/server";
import { serviceDb, getOrgId } from "@/lib/tenant";
import { rateLimited, tooMany } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";
const cut = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
export async function POST(req: Request) {
  if (await rateLimited(req, "log-error", 30, 600)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  let orgId: string | null = null; try { orgId = await getOrgId(); } catch { /* unknown tenant */ }
  await serviceDb().from("error_logs").insert({ org_id: orgId, app: "web", message: cut(body.message, 500)!, stack: cut(body.stack, 3000), digest: cut(body.digest, 80), path: cut(body.path, 200) });
  return NextResponse.json({ ok: true });
}
