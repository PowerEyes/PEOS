import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCartItems } from "../../web/src/lib/cart-normalize.ts";
import { applyDiscountCap, maxDiscountFromSettings } from "../../web/src/lib/discounts.ts";
import { FALLBACK_LENS_USAGE, shouldShowAdd, usageByCode } from "../../web/src/lib/lens-usage.ts";
import { prescriptionIsComplete, toRxSnapshot } from "../../web/src/lib/prescription.ts";

const PRODUCT = "10000000-0000-4000-8000-000000000001";
const LENS    = "20000000-0000-4000-8000-000000000002";
const OPTION  = "30000000-0000-4000-8000-000000000003";
const rx = { od: { sph: -2, cyl: 0, axis: null, add: 0 }, os: { sph: -1.5, cyl: 0, axis: null, add: 0 } };

test("a combined frame+lens cart item becomes two valid quote lines", () => {
  const { lines, error } = normalizeCartItems([{
    productId: PRODUCT, lensPackageId: LENS, optionIds: [OPTION], qty: 1,
    usage: "progressive", requires_rx: true, requires_add: true, rx,
  }]);
  assert.equal(error, undefined);
  assert.deepEqual(lines.map((l) => l.kind), ["product", "lens"]);
  assert.equal(lines[0].productId, PRODUCT);
  assert.equal(lines[0].optionIds.length, 0);
  assert.equal(lines[1].lensPackageId, LENS);
  assert.deepEqual(lines[1].optionIds, [OPTION]);
  assert.equal(lines[1].requires_add, true);
});

test("invalid cart rows are rejected rather than silently priced", () => {
  assert.match(normalizeCartItems([{ qty: 1 }]).error, /invalid item/);
  assert.match(normalizeCartItems([{ productId: "nope", qty: 1 }]).error, /invalid item/);
  assert.match(normalizeCartItems([{ productId: PRODUCT, qty: 0 }]).error, /quantities/);
  assert.match(normalizeCartItems([{ lensPackageId: LENS, optionIds: [OPTION, OPTION], qty: 1 }]).error, /invalid lens option/);
});

test("coupon discount is capped at the organisation setting", () => {
  assert.deepEqual(applyDiscountCap(1000, 150, 10), {
    discount: 100, capPct: 10, capped: true, capAmount: 100,
  });
  assert.equal(applyDiscountCap(1000, 50, 10).discount, 50);
  assert.equal(maxDiscountFromSettings([{ key: "max_staff_discount_pct", value: 15 }]), 15);
  assert.equal(maxDiscountFromSettings([{ key: "sales.max_discount_pct", value: 8 }, { key: "max_staff_discount_pct", value: 15 }]), 8);
  assert.equal(maxDiscountFromSettings([]), 10);
});

test("ADD is required for progressives, readers and bifocals only", () => {
  for (const code of ["progressive", "reading", "bifocal"]) {
    const usage = usageByCode(FALLBACK_LENS_USAGE, code);
    assert.equal(shouldShowAdd(usage), true);
    assert.equal(prescriptionIsComplete(usage, rx), false, `${code} must require ADD`);
    assert.equal(prescriptionIsComplete(usage, { ...rx, od: { ...rx.od, add: 1.25 }, os: { ...rx.os, add: 1.25 } }), true);
  }
  const single = usageByCode(FALLBACK_LENS_USAGE, "single");
  assert.equal(shouldShowAdd(single), false);
  assert.equal(prescriptionIsComplete(single, rx), true);
  const snapshot = toRxSnapshot({ ...rx, od: { ...rx.od, add: 2 }, os: { ...rx.os, add: 2 } }, single);
  assert.equal(snapshot.od_add, null);
  assert.equal(snapshot.os_add, null);
  const nonRx = usageByCode(FALLBACK_LENS_USAGE, "non_rx");
  assert.equal(prescriptionIsComplete(nonRx, {}), true);
});
