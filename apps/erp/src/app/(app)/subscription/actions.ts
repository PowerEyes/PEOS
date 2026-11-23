"use server";
// Company-facing subscription actions — owner/admin only, tenant-scoped.
// Plan changes and lifecycle transitions are recorded in subscription_events.
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseBilling } from "@/lib/supabase/admin";
import { createRazorpayOrder, isRazorpayConfigured, razorpayKeyId, verifyOrderSignature, nextPeriodEnd } from "@/lib/razorpay";
import { splitGst, planGate } from "@/lib/subscription-core";

type R = { error?: string; ok?: string };

async function ownerCtx(): Promise<R & { sb?: any; orgId?: string; userId?: string }> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).single();
  if (!["owner", "admin"].includes(profile?.role_key ?? "")) return { error: "Only owners and admins can manage the subscription." };
  if (!profile?.org_id) return { error: "No organisation linked to your account." };
  return { sb, orgId: profile.org_id, userId: user.id };
}

async function latestSub(sb: any, orgId: string) {
  const { data } = await sb.from("org_subscriptions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function logEvent(sb: any, orgId: string, eventType: string, payload: any = {}) {
  await sb.from("subscription_events").insert({ org_id: orgId, event_type: eventType, payload });
}

export async function changePlan(planId: string): Promise<R> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };
  const { data: plan } = await a.sb.from("billing_plans")
    .select("id, active, is_public, price_minor, interval")
    .eq("id", planId).maybeSingle();
  if (!plan || !plan.active) return { error: "That plan is not available." };
  // Only a plan that is genuinely free may be granted without a payment.
  // A NULL price means "contact sales" and must never be read as zero.
  if (planGate(plan.price_minor) === "unpriced") {
    return { error: "This plan is not sold online. Please contact billing to set it up." };
  }
  if (planGate(plan.price_minor) === "paid") {
    // A paid plan must never be granted without a payment — that path is checkout.
    return { error: "Paid plans are purchased through checkout — use the Subscribe button next to the plan." };
  }
  const sub = await latestSub(a.sb, a.orgId!);
  const now = new Date().toISOString();
  const end = nextPeriodEnd(plan.interval || "month").toISOString();
  let err;
  if (sub) ({ error: err } = await a.sb.from("org_subscriptions").update({
    plan_id: planId, status: "active", current_period_end: end,
    auto_renew: true, cancelled_at: null, grace_ends_at: null,
  }).eq("id", sub.id));
  else ({ error: err } = await a.sb.from("org_subscriptions").insert({
    org_id: a.orgId, plan_id: planId, status: "active",
    current_period_start: now, current_period_end: end, auto_renew: true,
  }));
  if (err) return { error: err.message };
  await logEvent(a.sb, a.orgId!, "subscription.plan_changed", { plan_id: planId });
  revalidatePath("/subscription");
  return { ok: "Plan updated. Your new entitlements apply immediately." };
}

export async function cancelSubscription(): Promise<R> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };
  const sub = await latestSub(a.sb, a.orgId!);
  if (!sub) return { error: "No active subscription." };
  const { error } = await a.sb.from("org_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), auto_renew: false }).eq("id", sub.id);
  if (error) return { error: error.message };
  await logEvent(a.sb, a.orgId!, "subscription.cancelled");
  revalidatePath("/subscription");
  return { ok: "Subscription cancelled. Your data is retained — you can export or reactivate any time." };
}

export async function reactivateSubscription(): Promise<R> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };
  const sub = await latestSub(a.sb, a.orgId!);
  if (!sub) return { error: "No subscription to reactivate." };
  const { error } = await a.sb.from("org_subscriptions").update({ status: "active", reactivated_at: new Date().toISOString(), current_period_start: new Date().toISOString(), auto_renew: true }).eq("id", sub.id);
  if (error) return { error: error.message };
  await logEvent(a.sb, a.orgId!, "subscription.reactivated");
  revalidatePath("/subscription");
  return { ok: "Subscription reactivated." };
}

export async function extendSubscription(days: number): Promise<R> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };
  const d = Math.min(365, Math.max(1, Math.round(days) || 30));
  const sub = await latestSub(a.sb, a.orgId!);
  if (!sub) return { error: "No subscription." };
  const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const end = new Date(Math.max(base.getTime(), Date.now()) + d * 86400000).toISOString();
  const { error } = await a.sb.from("org_subscriptions").update({ status: "active", current_period_end: end }).eq("id", sub.id);
  if (error) return { error: error.message };
  await logEvent(a.sb, a.orgId!, "subscription.extended", { days: d, end });
  revalidatePath("/subscription");
  return { ok: `Subscription extended by ${d} days.` };
}

// ---------------------------------------------------------------------------
// Razorpay checkout (plan phase 3)
//
// invoices/payments are SELECT-only under RLS, so this flow is:
//   1. owner/admin authz (ownerCtx)
//   2. create the order on Razorpay + an unpaid invoice (service role)
//   3. browser opens Razorpay Checkout and returns order/payment/signature
//   4. verify the HMAC, then settle through public.settle_subscription_payment,
//      which only the service role may execute.
// The webhook replays step 4 server-to-server; the function is idempotent, so
// whichever arrives first wins and the other is a no-op.
// ---------------------------------------------------------------------------

/** Platform GST rate in basis points. 1800 = 18%; anything unreadable defaults to 18%. */
async function gstRateBp(): Promise<number> {
  try {
    const { data } = await supabaseBilling().from("platform_settings")
      .select("value").eq("key", "saas_gst_rate_bp").maybeSingle();
    const bp = typeof data?.value === "number" ? data.value : Number(data?.value);
    return Number.isFinite(bp) && bp >= 0 ? bp : 1800;
  } catch {
    return 1800;
  }
}

type CheckoutStart = {
  error?: string;
  keyId?: string;
  orderId?: string;
  invoiceId?: string;
  invoiceNo?: string;
  amountMinor?: number;
  currency?: string;
  planName?: string;
};

export async function createCheckoutOrder(planId: string): Promise<CheckoutStart> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };

  const { data: plan } = await a.sb.from("billing_plans")
    .select("id, code, name, price_minor, currency, interval, active, is_public")
    .eq("id", planId).maybeSingle();
  if (!plan || !plan.active) return { error: "That plan does not exist." };
  if (!plan.active || !plan.is_public) return { error: "That plan is not available for purchase." };
  const gate = planGate(plan.price_minor);
  if (gate === "unpriced") return { error: "This plan is not sold online. Please contact billing." };
  if (gate === "free") return { error: "This plan is free — choose it from the plan selector instead." };
  if (!isRazorpayConfigured()) return { error: "Online payments are not configured on this deployment yet." };

  const split = splitGst(Number(plan.price_minor), await gstRateBp());
  const currency = plan.currency || "INR";

  let order;
  try {
    order = await createRazorpayOrder({
      amountMinor: split.totalMinor,
      currency,
      receipt: `org_${a.orgId}_${Date.now()}`,
      notes: { org_id: a.orgId!, plan_id: plan.id, plan_code: plan.code },
    });
  } catch (e: any) {
    return { error: e?.message || "Checkout could not be started." };
  }

  const db = supabaseBilling();

  // One live invoice per organisation: an earlier abandoned attempt is voided so the
  // billing history shows a single outstanding amount.
  await db.from("subscription_invoices")
    .update({ status: "void" })
    .eq("org_id", a.orgId!)
    .in("status", ["issued", "overdue"]);

  const { data: invoice, error } = await db.from("subscription_invoices").insert({
    org_id: a.orgId,
    plan_id: plan.id,
    amount_minor: split.totalMinor,
    tax_minor: split.taxMinor,
    currency,
    status: "issued",
    due_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    provider_order_id: order.id,
  }).select("id, invoice_no").single();
  if (error || !invoice) return { error: `Checkout could not be recorded: ${error?.message ?? "no invoice"}` };

  await logEvent(a.sb, a.orgId!, "subscription.checkout_started", {
    plan_id: plan.id, order_id: order.id, invoice_id: invoice.id, amount_minor: split.totalMinor,
  });

  return {
    keyId: razorpayKeyId(),
    orderId: order.id,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoice_no,
    amountMinor: split.totalMinor,
    currency,
    planName: plan.name,
  };
}

type CheckoutVerify = R & { invoiceNo?: string };

export async function verifyCheckoutPayment(input: {
  orderId?: string; paymentId?: string; signature?: string;
}): Promise<CheckoutVerify> {
  const a = await ownerCtx();
  if (a.error || !a.sb) return { error: a.error };
  const { orderId, paymentId, signature } = input || {};
  if (!orderId || !paymentId || !signature) return { error: "Payment details were missing. Please try again." };

  // 1. Signature check (pure + unit tested). Throws only when the key is absent.
  let signed = false;
  try {
    signed = verifyOrderSignature(orderId, paymentId, signature);
  } catch {
    return { error: "Payments are not configured on this deployment yet." };
  }
  if (!signed) return { error: "Payment verification failed. If you were charged, support will reconcile this for you." };

  // 2. Find the invoice inside this organisation — RLS scopes the read to current_org().
  const { data: invoice, error: invErr } = await a.sb.from("subscription_invoices")
    .select("id, org_id, amount_minor")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (invErr) return { error: invErr.message };
  if (!invoice) return { error: "We could not find that checkout. Please start it again." };

  // 3. Settle: service role + DB-side idempotency (see settle_subscription_payment).
  const { data, error } = await supabaseBilling().rpc("settle_subscription_payment", {
    p_org_id: invoice.org_id,
    p_invoice_id: invoice.id,
    p_provider_order_id: orderId,
    p_provider_payment_id: paymentId,
    p_amount_minor: invoice.amount_minor,
    p_provider: "razorpay",
  });
  if (error) return { error: `Payment could not be recorded: ${error.message}` };

  revalidatePath("/subscription");
  const settled = (data ?? {}) as { already_paid?: boolean; invoice_no?: string };
  return {
    ok: settled.already_paid ? "Payment already recorded — your plan is active." : "Payment received. Your plan is active.",
    invoiceNo: settled.invoice_no,
  };
}
