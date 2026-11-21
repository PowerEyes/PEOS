import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount); const notes = body?.notes;
  if (!isFinite(amount) || amount < 1 || amount > 500000) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  const key = process.env.RAZORPAY_KEY_ID; const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) return NextResponse.json({ error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local." }, { status: 503 });
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", { method:"POST", headers:{ Authorization:`Basic ${auth}`, "Content-Type":"application/json" }, body: JSON.stringify({ amount: Math.round(amount * 100), currency:"INR", notes, payment_capture:1 }) });
  const d = await r.json();
  if (!r.ok) return NextResponse.json({ error: d.error?.description ?? "Payment gateway error" }, { status: 400 });
  return NextResponse.json({ orderId: d.id, amount: d.amount, currency: d.currency });
}
