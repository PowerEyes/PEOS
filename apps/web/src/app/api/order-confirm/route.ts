import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getOrgId, serviceDb } from "@/lib/tenant";
import { rateLimited, tooMany } from "@/lib/ratelimit";
import { dbError } from "@poweros/business-rules";

const clean = (v: unknown, n: number) => typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "";

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

  const address = quote.address ?? {};
  const phone = clean(address.phone, 20).replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) return NextResponse.json({ error: "A valid 10-digit customer phone is required." }, { status: 400 });
  const email = typeof address.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim()) ? address.email.trim().toLowerCase() : null;

  if (paymentId) {
    const { data: previous } = await sb.from("online_payments").select("sale_id,sales(code)").eq("razorpay_payment_id", paymentId).not("sale_id", "is", null).maybeSingle();
    if (previous?.sale_id) return NextResponse.json({ code: (previous as any).sales?.code, id: previous.sale_id });
  }
  const { data: { user } } = await supabaseServer().auth.getUser();
  let customerId: string | null = null;
  if (user) { const { data: customer } = await sb.from("customers").select("id").eq("auth_user_id", user.id).eq("org_id", orgId).maybeSingle(); if (customer) customerId = customer.id; }
  if (!customerId && email) { const { data: customer } = await sb.from("customers").select("id").eq("org_id", orgId).ilike("email", email).limit(1).maybeSingle(); if (customer) customerId = customer.id; }
  if (!customerId) { const { data: customer } = await sb.from("customers").select("id").eq("org_id", orgId).eq("phone", phone).limit(1).maybeSingle(); if (customer) customerId = customer.id; }
  if (!customerId) {
    const { data: customer } = await sb.from("customers").insert({ org_id: orgId, full_name: clean(address.name, 80) || "Online Customer", phone, email, city: clean(address.city, 60) || null, state: clean(address.state, 60) || null, pincode: clean(address.pincode, 10) || null }).select("id").single();
    customerId = customer?.id ?? null;
  }
  if (!customerId) return NextResponse.json({ error: "Could not identify customer." }, { status: 500 });
  const prescriptionSnapshot = quote.prescription_snapshot && typeof quote.prescription_snapshot === "object"
    ? quote.prescription_snapshot
    : null;
  if (quote.prescription_required && !prescriptionSnapshot) {
    return NextResponse.json({ error: "Prescription details are missing for this order. Reopen checkout and re-enter them." }, { status: 400 });
  }
  const notes = `Online order.${quote.coupon_code ? ` Coupon ${clean(quote.coupon_code, 40)} applied.` : ""} ${quote.delivery === "pickup" ? `Pickup: ${clean(quote.branch_name, 100)}` : `Deliver to ${clean(address.line1, 200)}, ${clean(address.city, 60)} ${clean(address.pincode, 10)}`}. Razorpay: ${clean(razorpay_order_id, 80)}`;
  const payment = paymentId ? { amount: Number(quote.subtotal), method: "razorpay", reference: paymentId } : { amount: 0, method: "cash" };
  const { data: sale, error } = await sb.rpc("place_sale", {
    p: {
      org_id: orgId,
      idempotency_key: q.id,
      kind: "order",
      channel: "storefront",
      customer_id: customerId,
      branch_id: quote.branch_id,
      lines: quote.lines,
      notes,
      payment,
      prescription_snapshot: prescriptionSnapshot,
      coupon_id: typeof quote.coupon_id === "string" && /^[0-9a-f-]{36}$/i.test(quote.coupon_id) ? quote.coupon_id : null,
      discount: Number(quote.discount ?? 0),
    },
  });
  if (error) { console.error("place_sale error:", error.message); return NextResponse.json({ error: dbError(error.message) }, { status: 500 }); }
  if (paymentId) {
    const { error: pErr } = await sb.from("online_payments").upsert({ org_id: orgId, sale_id: sale.id, customer_id: customerId, razorpay_order_id, razorpay_payment_id: paymentId, razorpay_signature, amount: paidAmount, status: "paid" }, { onConflict: "razorpay_payment_id" });
    if (pErr) return NextResponse.json({ error: "Order was created; payment recording needs reconciliation." }, { status: 500 });
  }
  const { error: consumeError } = await sb.from("checkout_quotes").update({ status: "consumed", consumed_at: new Date().toISOString(), sale_id: sale.id }).eq("id", q.id).eq("status", "created");
  if (consumeError) console.error("Checkout quote consumption failed", consumeError.message);
  return NextResponse.json({ code: sale.code, id: sale.id });
}
