
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  // Read raw body — essential for HMAC verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET ?? "";

  // Verify signature
  if (webhookSecret) {
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (expected !== signature) {
      console.error("[rzp-webhook] signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return NextResponse.json({ ok: true }); // silently accept if not configured

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey);

  // ── payment.captured ─────────────────────────────────────────────────────
  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    if (!payment) return NextResponse.json({ ok: true });

    const { id: razorpay_payment_id, order_id: razorpay_order_id, amount, notes } = payment;

    // Check if we already recorded this payment (client-side confirm may have run first)
    const { data: existing } = await sb
      .from("online_payments")
      .select("id, sale_id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();

    if (existing?.sale_id) {
      // Already processed — just update status to be safe
      await sb.from("online_payments").update({ status: "paid" }).eq("id", existing.id);
      return NextResponse.json({ ok: true, already: true });
    }

    // Not yet processed — this means the client callback failed (browser closed, etc.)
    // Attempt to create the order from notes stored in the Razorpay order
    const customerPhone = notes?.phone ?? "";
    const customerEmail = notes?.email ?? "";
    const customerName = notes?.name ?? "Online Customer";

    let customerId: string | null = null;
    if (customerEmail) {
      const { data } = await sb.from("customers").select("id").eq("email", customerEmail).maybeSingle();
      if (data) customerId = data.id;
    }
    if (!customerId && customerPhone) {
      const { data } = await sb.from("customers").select("id").eq("phone", customerPhone.replace(/\D/g,"")).maybeSingle();
      if (data) customerId = data.id;
    }
    if (!customerId) {
      const { data } = await sb.from("customers").insert({
        org_id: ORG_ID, full_name: customerName,
        phone: customerPhone.replace(/\D/g,""), email: customerEmail || null,
        city: "Chennai", state: "Tamil Nadu", pincode: "600037",
      }).select("id").single();
      customerId = data?.id ?? null;
    }

    if (!customerId) {
      console.error("[rzp-webhook] could not find/create customer");
      return NextResponse.json({ error: "Customer not found" }, { status: 500 });
    }

    // Record the online payment
    await sb.from("online_payments").insert({
      org_id: ORG_ID, customer_id: customerId, sale_id: null,
      razorpay_order_id, razorpay_payment_id,
      amount: amount / 100, status: "paid",
    });

    console.log(`[rzp-webhook] payment captured: ${razorpay_payment_id} for customer ${customerId}`);
    return NextResponse.json({ ok: true });
  }

  // ── payment.failed ───────────────────────────────────────────────────────
  if (event.event === "payment.failed") {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id) {
      await sb.from("online_payments")
        .update({ status: "failed" })
        .eq("razorpay_order_id", payment.order_id);
      console.log(`[rzp-webhook] payment failed: ${payment.id}`);
    }
    return NextResponse.json({ ok: true });
  }

  // All other events acknowledged silently
  return NextResponse.json({ ok: true });
}
