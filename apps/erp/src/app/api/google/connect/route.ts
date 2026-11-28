import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { adminCtx } from "@/lib/admin-guard";
import { authUrl, googleConfigured } from "@/lib/google-drive";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const a = await adminCtx();
  if (!a) return NextResponse.redirect(new URL("/settings/backup?err=forbidden", req.url));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/settings/backup?err=not_configured", req.url));
  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("pe_gstate", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
