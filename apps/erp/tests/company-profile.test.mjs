import test from "node:test"; import assert from "node:assert/strict";
import { normalizeDocuments, normalizeBranding, normalizePolicies, daysUntil } from "../src/lib/company-profile.ts";

const doc = (over = {}) => ({
  title: "Shop licence", kind: "license", number: "TN/1",
  issued_on: "2026-01-01", expires_on: "2027-01-01", notes: "", ...over,
});

test("normalizeDocuments accepts well-formed rows, unknown kinds fall back", () => {
  const out = normalizeDocuments([doc(), doc({ kind: "nonsense" })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, "Shop licence");
  assert.equal(out[1].kind, "other");
});

test("normalizeDocuments refuses bad rows instead of storing junk", () => {
  assert.equal(normalizeDocuments("nope"), null);
  assert.equal(normalizeDocuments([doc({ title: "   " })]), null);
  assert.equal(normalizeDocuments([doc({ issued_on: "01/01/2026" })]), null);
  // expires before issued
  assert.equal(normalizeDocuments([doc({ issued_on: "2027-01-01", expires_on: "2026-01-01" })]), null);
  // one bad row rejects the whole save
  assert.equal(normalizeDocuments([doc(), doc({ title: "" })]), null);
  // 51 documents exceed the cap
  assert.equal(normalizeDocuments(Array.from({ length: 51 }, () => doc())), null);
});

test("normalizeDocuments trims and caps stored values", () => {
  const [d] = normalizeDocuments([doc({ title: "  Licence  ", number: "x".repeat(80), notes: "n".repeat(600) })]);
  assert.equal(d.title, "Licence");
  assert.equal(d.number.length, 60);
  assert.equal(d.notes.length, 500);
});

test("normalizeBranding validates logo URL and 6-digit hex colours", () => {
  assert.deepEqual(
    normalizeBranding({ logo_url: "https://x.co/l.png", primary: "#0A2240", accent: "#C48A3F" }),
    { logo_url: "https://x.co/l.png", primary: "#0A2240", accent: "#C48A3F" },
  );
  assert.deepEqual(
    normalizeBranding({ logo_url: "/logo.png", primary: "#0a2240", accent: "#c48a3f" }).logo_url,
    "/logo.png",
  );
  assert.equal(normalizeBranding({ logo_url: "javascript:alert(1)", primary: "#0A2240", accent: "#C48A3F" }), null);
  assert.equal(normalizeBranding({ logo_url: "", primary: "navy", accent: "#C48A3F" }), null);
  assert.equal(normalizeBranding({ logo_url: "", primary: "#0A2240", accent: "#fff" }), null);
  assert.equal(normalizeBranding(null), null);
});

test("normalizePolicies enforces the 4,000-character cap per text", () => {
  assert.deepEqual(
    normalizePolicies({ returns: "  r  ", warranty: "", privacy: "" }),
    { returns: "r", warranty: "", privacy: "" },
  );
  assert.equal(normalizePolicies({ returns: "x".repeat(4001), warranty: "", privacy: "" }), null);
  assert.equal(normalizePolicies({ returns: "", warranty: "", privacy: "x".repeat(4001) }), null);
  assert.equal(normalizePolicies("nope"), null);
});

test("daysUntil counts whole days from today and rejects garbage", () => {
  assert.equal(daysUntil(""), null);
  assert.equal(daysUntil("not-a-date"), null);
  const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal(daysUntil(soon), 5);
  const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  assert.equal(daysUntil(past), -2);
  assert.equal(daysUntil(new Date().toISOString().slice(0, 10)), 0);
});
