import test from "node:test";
import assert from "node:assert/strict";
import { finalizeStorefrontQuote } from "../../web/src/lib/storefront-order.ts";

const baseQuote = {
  id: "10000000-0000-4000-8000-000000000001",
  org_id: "20000000-0000-4000-8000-000000000001",
  status: "created",
  razorpay_order_id: "order_test_123",
  amount_minor: 125000,
  quote: {
    lines: [{ line_type: "product", qty: 1 }],
    branch_id: "30000000-0000-4000-8000-000000000001",
    customer: { name: "Test Customer", phone: "9876543210", email: "test@example.com" },
    address: null,
  },
};

const noDb = { from() { throw new Error("Database should not be reached for invalid input"); }, rpc() { throw new Error("Database should not be reached for invalid input"); } };

test("storefront settlement rejects a Razorpay order not linked to the quote", async () => {
  await assert.rejects(
    finalizeStorefrontQuote(noDb, baseQuote, { method: "razorpay", amount: 1250, paymentId: "pay_1", orderId: "order_other" }),
    /does not belong to this checkout quote/,
  );
});

test("storefront settlement rejects captured amount that differs from the quote", async () => {
  await assert.rejects(
    finalizeStorefrontQuote(noDb, baseQuote, { method: "razorpay", amount: 1249, paymentId: "pay_1", orderId: "order_test_123" }),
    /amount does not match/,
  );
});

test("storefront pickup settlement requires a valid customer phone before database writes", async () => {
  const quote = { ...baseQuote, quote: { ...baseQuote.quote, customer: { name: "Test", phone: "", email: null } } };
  await assert.rejects(
    finalizeStorefrontQuote(noDb, quote, { method: "cash", amount: 0, orderId: "COD" }),
    /valid 10-digit customer phone/,
  );
});

test("storefront settlement refuses a payment without a payment ID or gateway order ID", async () => {
  await assert.rejects(
    finalizeStorefrontQuote(noDb, baseQuote, { method: "razorpay", amount: 1250 }),
    /does not belong to this checkout quote/,
  );
});

test("storefront settlement refuses legacy online lens orders without an approved prescription", async () => {
  const quote = {
    ...baseQuote,
    quote: { ...baseQuote.quote, lines: [{ line_type: "lens", qty: 1, lens_package_id: "40000000-0000-4000-8000-000000000001" }] },
  };
  await assert.rejects(
    finalizeStorefrontQuote(noDb, quote, { method: "cash", amount: 0, orderId: "COD" }),
    /optometrist-approved prescription/,
  );
});
