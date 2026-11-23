import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const expected = process.env.INTEGRATION_HEALTH_TOKEN ?? "";
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Boolean(process.env.RAZORPAY_KEY_ID?.trim());
  const secret = Boolean(process.env.RAZORPAY_KEY_SECRET?.trim());
  return NextResponse.json(
    {
      razorpay: {
        configured: id && secret,
        mode: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")
          ? "live"
          : "test_or_unknown",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
