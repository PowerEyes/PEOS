import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db";
export const dynamic = "force-dynamic";
const s = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: bots fill the hidden field
  const db = serviceDb();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed } = await db.rpc("rate_limit_hit", { p_key: `lead:${ip}`, p_limit: 5, p_window_secs: 3600 });
  if (allowed === false) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  const row = { full_name: s(b.full_name, 120), business_name: s(b.business_name, 160), email: s(b.email, 254)?.toLowerCase(), phone: s(b.phone, 20), branches: Number.isInteger(+b.branches) && +b.branches >= 1 && +b.branches <= 1000 ? +b.branches : null, plan_code: s(b.plan_code, 40), message: s(b.message, 1000) };
  if (!row.full_name || !row.business_name || !row.email) return NextResponse.json({ error: "Please fill in your name, business and email." }, { status: 400 });
  const { error } = await db.from("saas_leads").insert(row);
  if (error && error.code !== "23505") return NextResponse.json({ error: "We could not save your request. Please try again." }, { status: error.code === "23514" ? 400 : 500 });
  return NextResponse.json({ ok: true }); // a duplicate open request is treated as success
}
