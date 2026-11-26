// Known-answer tests for the Razorpay signature helpers (lib/razorpay.ts).
// The vectors are real HMAC-SHA256 digests computed independently with `crypto`,
// so a change to the payload format or digest fails here rather than at checkout.
import test from "node:test";
import assert from "node:assert/strict";
import {
  orderSignature, verifyOrderSignature, webhookSignature, verifyWebhookSignature,
  nextPeriodEnd, isRazorpayConfigured, razorpayKeyId,
} from "../src/lib/razorpay.ts";

const ORDER_VEC = "db56b4c06484fdea64af01b04b56d2b090011fd1a2e47415f5f11b47f08b13e7";
const WEBHOOK_VEC = "4f463a57dd128675850163391f0311888616d57bccca75c774c9cdb28134f851";

test("orderSignature matches the documented payload format", () => {
  assert.equal(orderSignature("order_TEST123", "pay_TEST456", "k_test_secret"), ORDER_VEC);
});

test("verifyOrderSignature accepts the correct signature", () => {
  const sig = orderSignature("order_TEST123", "pay_TEST456", "k_test_secret");
  assert.equal(verifyOrderSignature("order_TEST123", "pay_TEST456", sig, "k_test_secret"), true);
});

test("verifyOrderSignature rejects a tampered payment id", () => {
  const sig = orderSignature("order_TEST123", "pay_TEST456", "k_test_secret");
  assert.equal(verifyOrderSignature("order_TEST123", "pay_TEST999", sig, "k_test_secret"), false);
});

test("verifyOrderSignature rejects a wrong key secret", () => {
  const sig = orderSignature("order_TEST123", "pay_TEST456", "k_test_secret");
  assert.equal(verifyOrderSignature("order_TEST123", "pay_TEST456", sig, "other_secret"), false);
});

test("verifyOrderSignature rejects empty / missing inputs", () => {
  assert.equal(verifyOrderSignature("", "pay_x", "sig", "s"), false);
  assert.equal(verifyOrderSignature("order_x", "", "sig", "s"), false);
  assert.equal(verifyOrderSignature("order_x", "pay_x", "", "s"), false);
  assert.equal(verifyOrderSignature(null, undefined, undefined, "s"), false);
});

test("verifyOrderSignature rejects a signature of a different length", () => {
  assert.equal(verifyOrderSignature("order_x", "pay_x", "deadbeef", "s"), false);
});

test("webhookSignature matches a raw body digest", () => {
  assert.equal(webhookSignature('{"event":"payment.captured"}', "whsec_test"), WEBHOOK_VEC);
});

test("verifyWebhookSignature accepts the right body and rejects a modified one", () => {
  const body = '{"event":"payment.captured"}';
  const sig = webhookSignature(body, "whsec_test");
  assert.equal(verifyWebhookSignature(body, sig, "whsec_test"), true);
  assert.equal(verifyWebhookSignature('{"event":"payment.failed"}', sig, "whsec_test"), false);
  assert.equal(verifyWebhookSignature(body, sig, "wrong_secret"), false);
});

test("verifyWebhookSignature fails closed on missing secret or signature", () => {
  assert.equal(verifyWebhookSignature("{}", "sig", null), false);
  assert.equal(verifyWebhookSignature("{}", null, "secret"), false);
  assert.equal(verifyWebhookSignature(null, "sig", "secret"), false);
});

test("nextPeriodEnd advances a month and a year", () => {
  const from = new Date(Date.UTC(2026, 0, 15, 10, 0, 0)); // 15 Jan 2026
  assert.equal(nextPeriodEnd("month", from).toISOString(), "2026-02-15T10:00:00.000Z");
  assert.equal(nextPeriodEnd("year", from).toISOString(), "2027-01-15T10:00:00.000Z");
});

test("nextPeriodEnd rolls over month ends", () => {
  const from = new Date(Date.UTC(2026, 0, 31, 0, 0, 0)); // 31 Jan 2026
  const end = nextPeriodEnd("month", from);
  assert.equal(end.getUTCMonth(), 1); // clamped to February (1), must not skip to March
  assert.equal(end.getUTCDate(), 28);
});

test("nextPeriodEnd defaults an unknown interval to a month", () => {
  const from = new Date(Date.UTC(2026, 5, 1));
  assert.equal(nextPeriodEnd("fortnight", from).toISOString(), "2026-07-01T00:00:00.000Z");
});

test("isRazorpayConfigured reflects both server keys", () => {
  const oldId = process.env.RAZORPAY_KEY_ID;
  const oldSecret = process.env.RAZORPAY_KEY_SECRET;
  try {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    assert.equal(isRazorpayConfigured(), false);
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    assert.equal(isRazorpayConfigured(), false);
    process.env.RAZORPAY_KEY_SECRET = "secret";
    assert.equal(isRazorpayConfigured(), true);
  } finally {
    if (oldId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = oldId;
    if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = oldSecret;
  }
});

test("razorpayKeyId falls back from the public key to the secret key id", () => {
  const pub = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const priv = process.env.RAZORPAY_KEY_ID;
  try {
    process.env.RAZORPAY_KEY_ID = "rzp_priv";
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    assert.equal(razorpayKeyId(), "rzp_priv");
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_pub";
    assert.equal(razorpayKeyId(), "rzp_pub");
  } finally {
    if (pub === undefined) delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID; else process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = pub;
    if (priv === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = priv;
  }
});
