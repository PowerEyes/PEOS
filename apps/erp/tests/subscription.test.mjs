import test from "node:test"; import assert from "node:assert/strict";
import {
  isLive, writesBlocked, hasFeature, hasFeatureTier, limitOf, withinLimit,
  assertWritable, assertFeature, assertLimit, entitlementMessage, EntitlementError,
  isEnforcementActive, subscriptionWriteBlock, splitGst, planGate,
} from "../src/lib/subscription-core.ts";

const live = (status, features = {}, limits = {}) => ({ status, features, limits });

test("live statuses grant access; restricted block writes", () => {
  for (const s of ["trialing", "active", "grace", "past_due"]) assert.equal(writesBlocked(live(s)), false, s);
  for (const s of ["expired", "suspended", "cancelled", "none", "inactive"]) assert.equal(writesBlocked(live(s)), true, s);
  assert.equal(writesBlocked(null), true);
  assert.equal(isLive(live("active")), true);
  assert.equal(isLive(live("expired")), false);
});

test("_writes_blocked feature forces restricted even on a live status", () => {
  assert.equal(writesBlocked(live("active", { _writes_blocked: true })), true);
});

test("enforcement knob: only 'enforce' blocks, everything else is log-only", () => {
  assert.equal(isEnforcementActive("enforce"), true);
  // plan 9.5 default — a fresh install, and any unreadable or unexpected value,
  // is log-only so the rollout can never fail closed on a customer.
  for (const m of ["log", "", null, undefined, "LOG", "banana"]) {
    assert.equal(isEnforcementActive(m), false, String(m));
  }
});

test("subscriptionWriteBlock: refuses only a blocked subscription while enforcing", () => {
  const msg = "Your subscription is not active. Renew or upgrade to continue making changes.";
  // live subscription -> never blocked, whatever the mode
  assert.equal(subscriptionWriteBlock(live("active"), "enforce"), null);
  assert.equal(subscriptionWriteBlock(live("trialing"), "log"), null);
  // blocked subscription -> enforced refusal
  assert.equal(subscriptionWriteBlock(live("expired"), "enforce"), msg);
  assert.equal(subscriptionWriteBlock(null, "enforce"), msg);
  // blocked subscription -> log-only lets it through (plan 9.5)
  assert.equal(subscriptionWriteBlock(live("expired"), "log"), null);
  assert.equal(subscriptionWriteBlock(null, undefined), null);
  // feature flag beats a live status in both modes
  assert.equal(subscriptionWriteBlock(live("active", { _writes_blocked: true }), "enforce"), msg);
  assert.equal(subscriptionWriteBlock(live("active", { _writes_blocked: true }), "log"), null);
});

test("hasFeature boolean/string truthiness", () => {
  const e = live("active", { pos: true, lab: "advanced", finance: "false", lpims: "" });
  assert.equal(hasFeature(e, "pos"), true);
  assert.equal(hasFeature(e, "lab"), true);
  assert.equal(hasFeature(e, "finance"), false);
  assert.equal(hasFeature(e, "lpims"), false);
  assert.equal(hasFeature(e, "missing"), false);
  assert.equal(hasFeature(null, "pos"), false);
});

test("hasFeatureTier ranks basic/limited < advanced < true", () => {
  const e = live("active", { lab: "basic", lpims: "advanced", api: "limited", pos: true, none: false });
  assert.equal(hasFeatureTier(e, "lab", "basic"), true);
  assert.equal(hasFeatureTier(e, "lab", "advanced"), false);
  assert.equal(hasFeatureTier(e, "lpims", "advanced"), true);
  assert.equal(hasFeatureTier(e, "api", "basic"), true);
  assert.equal(hasFeatureTier(e, "pos", "true"), true);
  assert.equal(hasFeatureTier(e, "none", "basic"), false);
});

test("limits: null = unlimited, numeric enforced", () => {
  const e = live("active", {}, { branches: 2, employees: null });
  assert.equal(limitOf(e, "branches"), 2);
  assert.equal(limitOf(e, "employees"), null);
  assert.equal(withinLimit(e, "branches", 1), true);
  assert.equal(withinLimit(e, "branches", 2), false);
  assert.equal(withinLimit(e, "employees", 9999), true);
  assert.equal(withinLimit(null, "branches", 0), false);
});

test("assert* throw EntitlementError with the right reason", () => {
  assert.throws(() => assertWritable(live("expired")), (e) => e instanceof EntitlementError && e.reason === "subscription_expired");
  assert.throws(() => assertFeature(live("active"), "nope"), (e) => e instanceof EntitlementError && e.reason === "feature_not_in_plan");
  assert.throws(() => assertLimit(live("active", {}, { branches: 1 }), "branches", 1), (e) => e instanceof EntitlementError && e.reason === "limit_reached");
  assert.doesNotThrow(() => assertWritable(live("active")));
});

test("entitlementMessage is human-readable", () => {
  assert.match(entitlementMessage(new EntitlementError("_writes", "subscription_expired")), /expired/i);
  assert.match(entitlementMessage(new EntitlementError("branches", "limit_reached")), /limit/i);
  assert.match(entitlementMessage(new EntitlementError("lab")), /not included/i);
  assert.equal(entitlementMessage(new Error("other")), "");
});

test("splitGst splits a GST-inclusive price at 18% without losing a paisa", () => {
  const r = splitGst(99900, 1800);
  assert.equal(r.taxableMinor, 84661);
  assert.equal(r.taxMinor, 15239);
  assert.equal(r.taxableMinor + r.taxMinor, r.totalMinor, "rounding must land back on the total");
});

test("splitGst on the Growth plan price also balances", () => {
  const r = splitGst(299900, 1800);
  assert.equal(r.taxableMinor, 254153);
  assert.equal(r.taxMinor, 45747);
  assert.equal(r.taxableMinor + r.taxMinor, 299900);
});

test("splitGst with no rate takes no tax", () => {
  assert.deepEqual(splitGst(100, 0), { totalMinor: 100, taxableMinor: 100, taxMinor: 0 });
  // Unreadable / nonsensical rates fall back to zero rather than inventing tax.
  assert.deepEqual(splitGst(99900, NaN), { totalMinor: 99900, taxableMinor: 99900, taxMinor: 0 });
  assert.deepEqual(splitGst(99900, -1), { totalMinor: 99900, taxableMinor: 99900, taxMinor: 0 });
});

test("splitGst clamps zero and negative totals", () => {
  assert.deepEqual(splitGst(0, 1800), { totalMinor: 0, taxableMinor: 0, taxMinor: 0 });
  assert.deepEqual(splitGst(-50, 1800), { totalMinor: 0, taxableMinor: 0, taxMinor: 0 });
});

test("splitGst balances across a wide range of totals", () => {
  for (const total of [1, 7, 99, 100, 101, 12345, 99900, 299900, 9999999, 100000001]) {
    for (const bp of [0, 500, 1200, 1800, 2800]) {
      const r = splitGst(total, bp);
      assert.equal(r.taxableMinor + r.taxMinor, r.totalMinor, `total=${total} bp=${bp}`);
      assert.ok(r.taxMinor >= 0 && r.taxableMinor >= 0, `non-negative for total=${total} bp=${bp}`);
    }
  }
});

test("planGate separates paid, free and unpriced", () => {
  assert.equal(planGate(99900), "paid");
  assert.equal(planGate(299900), "paid");
  assert.equal(planGate(0), "free");
  assert.equal(planGate("0"), "free");
  // The regression this guards: JSON null coerces to 0 with Number(), which would
  // hand out an unpriced Enterprise plan for nothing.
  assert.equal(planGate(null), "unpriced");
  assert.equal(planGate(undefined), "unpriced");
  assert.equal(planGate(""), "unpriced");
  assert.equal(planGate(-1), "unpriced");
  assert.equal(planGate(NaN), "unpriced");
  assert.equal(planGate("not-a-price"), "unpriced");
});

test("planGate accepts numeric strings from the API", () => {
  assert.equal(planGate("99900"), "paid");
  assert.equal(planGate("0"), "free");
});
