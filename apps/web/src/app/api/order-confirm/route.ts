import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getOrgId, serviceDb } from "@/lib/tenant";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { dbError } from "@poweros/business-rules";
import { finalizeStorefrontQuote } from "@/lib/storefront-order";


export async function POST(req: Request) {
  if (await rateLimited(req, "order-confirm", 30, 600)) return tooMany();
  const body = await req.json().catch(() => null);
  if (!body || !/^[0-9a-f-]{36}$/i.test(String(body.quoteId ?? ""))) return NextResponse.json({ error: "Secure checkout quote is required." }, { status: 400 });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payMethod } = body;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
  const orgId = await getOrgId(), sb = serviceDb();
  const { data: q, error: qe } = await sb.from("checkout_quotes").select("*").eq("id", body.quoteId).eq("org_id", orgId).maybeSingle();
  if (qe || !q) return NextResponse.json({ error: "Checkout quote not found." }, { status: 404 });
  if (q.status === "consumed" && q.sale_id) {
    const { data: existing } = await sb.from("sales").select("id,code").eq("id", q.sale_id).maybeSingle();
    if (existing) return NextResponse.json({ code: existing.code, id: existing.id });
  }
  if (q.status !== "created" || new Date(q.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Checkout quote expired or already used. Reopen checkout." }, { status: 409 });
  const quote = q.quote as any;
  if (!quote || !Array.isArray(quote.lines) || !quote.lines.length || !quote.branch_id || !Number.isFinite(Number(quote.subtotal))) return NextResponse.json({ error: "Checkout quote is invalid." }, { status: 400 });

  let paymentId: string | null = null, paidAmount = 0;
  if (razorpay_payment_id) {
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret || !razorpay_order_id || !razorpay_signature || q.razorpay_order_id !== razorpay_order_id) return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    const expected = crypto.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(String(razorpay_signature), "hex"); } catch { return NextResponse.json({ error: "Payment verification failed." }, { status: 400 }); }
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` }, signal: AbortSignal.timeout(12000), cache: "no-store",
    }).catch(() => null);
    const gatewayPayment = await response?.json().catch(() => null);
    if (!response?.ok || !gatewayPayment || gatewayPayment.order_id !== razorpay_order_id || gatewayPayment.status !== "captured" || gatewayPayment.currency !== "INR" || Number(gatewayPayment.amount) !== Number(q.amount_minor)) return NextResponse.json({ error: "Captured payment does not match the server-calculated checkout total." }, { status: 400 });
    paymentId = String(razorpay_payment_id); paidAmount = Number(gatewayPayment.amount) / 100;
  } else if (payMethod !== "cash" || razorpay_order_id !== "COD") {
    return NextResponse.json({ error: "Select a valid payment method." }, { status: 400 });
  }
  if (!Array.isArray(quote.lines) || quote.lines.some((l: any) => !l || !["product", "accessory", "lens", "service"].includes(l.line_type) || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 10) || quote.lines.filter((l:any)=>l.line_type==="service").some((l:any)=>l.description!=="Delivery fee"||l.qty!==1||Number(l.unit_price)!==Number(quote.delivery_fee)||Number(l.tax_pct)!==0)) return NextResponse.json({ error: "Saved checkout lines are invalid." }, { status: 400 });

  const { data: { user } } = await supabaseServer().auth.getUser();
  try {
    const finalized = await finalizeStorefrontQuote(sb, q, {
      method: paymentId ? "razorpay" : "cash",
      amount: paidAmount,
      paymentId,
      orderId: razorpay_order_id,
      signature: razorpay_signature,
    }, user?.id ?? null);
    return NextResponse.json({ code: finalized.code, id: finalized.id });
  } catch (error: any) {
    console.error("Storefront order finalization failed:", error?.message ?? error);
    return NextResponse.json({ error: dbError(error?.message ?? "Could not finalize order.") }, { status: 500 });
  }
}
