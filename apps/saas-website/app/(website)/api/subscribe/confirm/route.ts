import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSiteSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  const session = await getSiteSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const signature = String(body.razorpay_signature || "");
  const subscriptionId = String(body.subscription_id || "");

  if (!orderId || !paymentId || !signature || !subscriptionId) {
    return NextResponse.json({ error: "Missing checkout details" }, { status: 400 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json(
      { error: "Razorpay is not configured on the server" },
      { status: 503 }
    );
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (!safeEqual(expected, signature)) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("id,org_id,plan_id,checkout_signature")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (
    !subscription ||
    subscription.org_id !== session.primaryOrganisationId ||
    !subscription.checkout_signature ||
    !safeEqual(
      subscription.checkout_signature,
      createHmac("sha256", keySecret).update(`${orderId}|${subscriptionId}`).digest("hex")
    )
  ) {
    return NextResponse.json({ error: "Checkout could not be matched" }, { status: 400 });
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error } = await admin
    .from("organization_subscriptions")
    .update({
      status: "active",
      razorpay_subscription_id: paymentId,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("organizations")
    .update({ plan: subscription.plan_id, status: "active", updated_at: new Date().toISOString() })
    .eq("id", subscription.org_id);

  return NextResponse.json({ success: true });
}
