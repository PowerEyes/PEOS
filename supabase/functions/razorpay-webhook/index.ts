// Razorpay webhook receiver (plan phase 3).
//
// Razorpay posts here server-to-server when a payment settles, which is the
// authoritative path: if the browser callback never runs (closed tab, dropped
// connection) this still activates the plan. It settles through the same
// idempotent public.settle_subscription_payment() that checkout uses, so both
// paths can run and whichever arrives first wins.
//
// Requires RAZORPAY_WEBHOOK_SECRET (Razorpay dashboard -> Settings -> Webhooks).
// With no secret the endpoint refuses everything rather than trusting a body it
// cannot verify.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time hex compare — never returns early on the first differing byte. */
function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "function is not configured" }, 500);
  if (!webhookSecret) return json({ error: "RAZORPAY_WEBHOOK_SECRET is not set" }, 503);

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!safeEqualHex(await hmacSha256Hex(webhookSecret, raw), signature)) {
    return json({ error: "invalid signature" }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "body is not JSON" }, 400);
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const eventName = String(event?.event ?? "unknown");
  const eventId = typeof event?.id === "string" ? event.id : null;
  const payment = event?.payload?.payment?.entity;
  const orderId: string | null = payment?.order_id ?? null;

  // Read the invoice first so the replay guard below is scoped to the right org.
  let invoice: any = null;
  if (orderId) {
    const { data } = await sb.from("subscription_invoices")
      .select("id, org_id, amount_minor, status")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    invoice = data;
  }

  // Replay protection. provider_event_id is UNIQUE (20261205000000), so a redelivery
  // of the same event short-circuits here instead of settling twice.
  // org_id is NOT NULL, so an event we cannot map to a tenant has nothing to settle
  // and no row to write — it is simply acknowledged below.
  if (eventId && invoice?.org_id) {
    const { error } = await sb.from("subscription_events").insert({
      org_id: invoice.org_id,
      event_type: `razorpay.${eventName}`,
      payload: event,
      provider_event_id: eventId,
    });
    if (error) {
      if (error.code === "23505") return json({ ok: true, duplicate: true });
      // Never let the bookkeeping row block a real payment — log and continue.
      console.error("[razorpay-webhook] replay record failed:", error.message);
    }
  }

  if (eventName === "payment.captured") {
    // An order we do not recognise is almost certainly someone else's test hook.
    if (!invoice || !orderId) return json({ ok: true, ignored: "no matching invoice" });

    // Capture the exact paise we invoiced; anything else is a bookkeeping bug and
    // must not activate a plan.
    const captured = Number(payment?.amount ?? -1);
    if (captured !== Number(invoice.amount_minor)) {
      console.error(
        `[razorpay-webhook] amount mismatch order=${orderId} invoiced=${invoice.amount_minor} captured=${captured}`,
      );
      await sb.from("subscription_events").insert({
        org_id: invoice.org_id,
        event_type: "subscription.payment_amount_mismatch",
        payload: { order_id: orderId, invoiced: invoice.amount_minor, captured },
      });
      return json({ ok: false, error: "captured amount does not match invoice" }, 400);
    }

    const { data, error } = await sb.rpc("settle_subscription_payment", {
      p_org_id: invoice.org_id,
      p_invoice_id: invoice.id,
      p_provider_order_id: orderId,
      p_provider_payment_id: payment?.id ?? null,
      p_amount_minor: invoice.amount_minor,
      p_provider: "razorpay",
    });
    if (error) {
      console.error("[razorpay-webhook] settle failed:", error.message);
      return json({ error: error.message }, 500); // non-2xx -> Razorpay retries
    }
    return json({ ok: true, settled: data });
  }

  if (eventName === "payment.failed") {
    if (invoice) {
      await sb.from("subscription_events").insert({
        org_id: invoice.org_id,
        event_type: "subscription.payment_failed",
        payload: {
          order_id: orderId,
          payment_id: payment?.id,
          description: payment?.error_description ?? null,
        },
      });
    }
    return json({ ok: true });
  }

  // Everything else (subscription.charged, refund processed, ...) is recorded by the
  // replay row above; acknowledge so Razorpay stops retrying.
  return json({ ok: true, ignored: eventName });
});
