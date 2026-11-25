import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/tenant";
import { finalizeStorefrontQuote } from "@/lib/storefront-order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "hex"); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  // Only captured storefront payments create orders. Failed/other events are
  // acknowledged without changing an already-paid order.
  if (event.event !== "payment.captured") return NextResponse.json({ ok: true, ignored: event.event });

  const payment = event.payload?.payment?.entity;
  const orderId = typeof payment?.order_id === "string" ? payment.order_id : "";
  const paymentId = typeof payment?.id === "string" ? payment.id : "";
  if (!orderId || !paymentId || payment?.status !== "captured") {
    return NextResponse.json({ error: "Captured payment payload is incomplete." }, { status: 400 });
  }

  try {
    const db = serviceDb();
    // Resolve the tenant from the immutable server-created checkout quote, never
    // from the webhook request host. A shared Razorpay webhook URL serves all shops.
    const quoteId = typeof payment.notes?.quote_id === "string" ? payment.notes.quote_id : "";
    let quoteQuery = db.from("checkout_quotes").select("*").eq("razorpay_order_id", orderId);
    if (quoteId) quoteQuery = quoteQuery.eq("id", quoteId);
    const { data: quote, error: quoteError } = await quoteQuery.maybeSingle();
    if (quoteError) throw new Error("Could not resolve the checkout quote for this payment.");
    if (!quote) {
      console.error("[rzp-webhook] captured payment has no matching checkout quote", { orderId, paymentId, quoteId });
      if (quoteId) return NextResponse.json({ error: "Captured payment quote is not available for finalization." }, { status: 500 });
      return NextResponse.json({ ok: true, ignored: true });
    }
    if (payment.currency !== quote.currency || Number(payment.amount) !== Number(quote.amount_minor)) {
      console.error("[rzp-webhook] captured payment amount does not match quote", { orderId, paymentId, quoteId: quote.id });
      return NextResponse.json({ error: "Captured payment does not match the checkout quote." }, { status: 400 });
    }

    if (quote.status === "consumed" && quote.sale_id) {
      return NextResponse.json({ ok: true, already: true, sale_id: quote.sale_id });
    }

    const { data: existingPayment, error: existingError } = await db.from("online_payments")
      .select("sale_id,razorpay_order_id").eq("razorpay_payment_id", paymentId).maybeSingle();
    if (existingError) throw new Error("Could not check payment replay state.");
    if (existingPayment?.razorpay_order_id && existingPayment.razorpay_order_id !== orderId) {
      return NextResponse.json({ error: "Payment ID is already associated with another order." }, { status: 409 });
    }
    if (existingPayment?.sale_id) {
      await db.from("checkout_quotes").update({
        status: "consumed", consumed_at: new Date().toISOString(), sale_id: existingPayment.sale_id,
      }).eq("id", quote.id).neq("status", "consumed");
      return NextResponse.json({ ok: true, already: true, sale_id: existingPayment.sale_id });
    }

    const finalized = await finalizeStorefrontQuote(db, quote, {
      method: "razorpay",
      amount: Number(payment.amount) / 100,
      paymentId,
      orderId,
      signature: null,
    });
    return NextResponse.json({ ok: true, sale_id: finalized.id, already: finalized.alreadyCompleted });
  } catch (error: any) {
    console.error("[rzp-webhook] storefront settlement failed:", error?.message ?? error);
    // 5xx asks Razorpay to retry. place_sale is idempotent on quote ID, so retries
    // cannot create duplicate sales or consume stock twice.
    return NextResponse.json({ error: "Payment was captured but order finalization needs retry." }, { status: 500 });
  }
}
