// Server-side Razorpay helpers for subscription checkout (plan phase 3).
// The signature functions are pure so tests/razorpay.test.mjs can pin them to
// known-answer vectors; only createRazorpayOrder() touches the network.
// Credentials come from the same .env keys the POS already uses.
import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayOrder = {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  notes?: Record<string, string>;
};

/** Both server-side credentials present? Used to fall back to an offline invoice. */
export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Key id the browser needs to open Razorpay Checkout (public by design). */
export function razorpayKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

function keySecret(): string {
  const s = process.env.RAZORPAY_KEY_SECRET;
  if (!s) throw new Error("Razorpay is not configured: RAZORPAY_KEY_SECRET is missing.");
  return s;
}

const hmacHex = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("hex");

/** Constant-time compare; never logs or echoes either side. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  return ab.length > 0 && ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Razorpay Checkout returns HMAC-SHA256("<order_id>|<payment_id>"). */
export function orderSignature(orderId: string, paymentId: string, secret: string): string {
  return hmacHex(`${orderId}|${paymentId}`, secret);
}

export function verifyOrderSignature(
  orderId: string | null | undefined,
  paymentId: string | null | undefined,
  signature: string | null | undefined,
  secret: string = keySecret(),
): boolean {
  if (!orderId || !paymentId || !signature) return false;
  return safeEqual(orderSignature(orderId, paymentId, secret), signature);
}

/** Razorpay signs the raw webhook body with the webhook secret configured in their dashboard. */
export function webhookSignature(rawBody: string, secret: string): string {
  return hmacHex(rawBody, secret);
}

export function verifyWebhookSignature(
  rawBody: string | null | undefined,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!rawBody || !signature || !secret) return false;
  return safeEqual(webhookSignature(rawBody, secret), signature);
}

/**
 * Creates an order on Razorpay. Amount is minor units (paise) — billing_plans
 * already stores price_minor, so no rounding happens here.
 */
export async function createRazorpayOrder(opts: {
  amountMinor: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("Razorpay is not configured: RAZORPAY_KEY_ID is missing.");
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor <= 0) throw new Error("Invalid order amount.");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret()}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(opts.amountMinor),
      currency: opts.currency || "INR",
      receipt: opts.receipt,
      notes: opts.notes || {},
    }),
  });

  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body?.id) {
    const desc = body?.error?.description || `HTTP ${res.status}`;
    throw new Error(`Razorpay order could not be created: ${desc}`);
  }
  return body as RazorpayOrder;
}

/** Pure check: a gateway payment object matches the order, amount and currency we expect. */
export function paymentMatches(p: any, expect: { orderId: string; amountMinor: number; currency?: string }): boolean {
  return Boolean(p) && p.order_id === expect.orderId && (p.status === "captured" || p.status === "authorized" && p.captured === true)
    && Number(p.amount) === Number(expect.amountMinor) && (p.currency || "INR") === (expect.currency || "INR");
}

/** Fetches the payment from Razorpay so the paid amount is checked against our own invoice. */
export async function fetchRazorpayPayment(paymentId: string): Promise<any | null> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) return null;
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret()}`).toString("base64")}` },
    signal: AbortSignal.timeout(12000), cache: "no-store",
  }).catch(() => null);
  return res?.ok ? await res.json().catch(() => null) : null;
}

/**
 * End of the paid period for an interval, from a start instant (UTC).
 * Clamps to the last day of the target month so a 31 Jan start does not
 * silently skip into March (and 29 Feb does not drift to 1 Mar).
 */
export function nextPeriodEnd(interval: string, from: Date = new Date()): Date {
  const monthsAhead = interval === "year" ? 12 : 1;
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + monthsAhead;
  const targetY = y + Math.floor(m / 12);
  const targetM = m % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetY, targetM, Math.min(from.getUTCDate(), lastDay),
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}
