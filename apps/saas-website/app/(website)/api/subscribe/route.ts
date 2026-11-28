import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getSiteSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getSiteSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.primaryOrganisationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "No organisation found for this account" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const planId = String(body.plan_id || "starter");
  const period = body.period === "yearly" ? "yearly" : "monthly";

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id,name,price_monthly,price_yearly,currency")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "Razorpay is not configured on the server" },
      { status: 503 }
    );
  }

  const amount = Math.round(Number(period === "yearly" ? plan.price_yearly : plan.price_monthly) * 100);
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: plan.currency || "INR",
      receipt: `poweros_${orgId}_${Date.now()}`,
      notes: { org_id: orgId, plan_id: planId, period },
    }),
  });

  if (!razorpayResponse.ok) {
    const detail = await razorpayResponse.text();
    return NextResponse.json(
      { error: `Razorpay order creation failed: ${detail}` },
      { status: 502 }
    );
  }

  const order = await razorpayResponse.json();

  const { data: subscription, error } = await admin
    .from("organization_subscriptions")
    .insert({
      org_id: orgId,
      plan_id: planId,
      status: "pending",
      current_period_start: new Date().toISOString(),
    })
    .select("id,plan_id,status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Store a short-lived integrity signature for the checkout confirmation.
  await admin.from("organization_subscriptions").update({
    checkout_signature: createHmac("sha256", keySecret)
      .update(`${order.id}|${subscription.id}`)
      .digest("hex"),
  }).eq("id", subscription.id);

  return NextResponse.json({
    success: true,
    subscription,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    },
    plan: { id: plan.id, name: plan.name, period },
  });
}
