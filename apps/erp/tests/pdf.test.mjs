import test from "node:test"; import assert from "node:assert/strict";
import { buildDocPdf } from "../src/lib/doc-render.ts";
// Minimal chainable fake of the Supabase client returning fixed rows.
const rows = {
  organizations: { name: "Test Opticals" },
  sales: { id: "s1", code: "INV-0001", kind: "invoice", gst_applied: true, created_at: "2026-11-01", grand_total: 1180, paid_total: 500, cgst_total: 90, sgst_total: 90, igst_total: 0, discount_total: 0,
    customers: { full_name: "Anita ₹ Kumar", phone: "9876543210" }, branches: { name: "East", address: "Chennai", phone: "044" }, payments: [],
    sale_lines: [{ line_no: 1, description: "Titan frame (blue)", qty: 1, unit_price: 1000, line_total: 1180 }, ...Array.from({ length: 60 }, (_, i) => ({ line_no: i + 2, description: "Extra item " + i, qty: 1, unit_price: 1, line_total: 1 }))] },
  prescriptions: { rx_code: "RX-1", rx_date: "2026-11-01", od_sph: "-1.00", os_sph: "-1.25", customers: { full_name: "Anita", phone: "98" } },
};
const fake = { from: (t) => { const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: rows[t] ?? null }) }; return q; } };
test("invoice PDF is a valid multi-page PDF", async () => {
  const r = await buildDocPdf(fake, "sale", "s1"); assert.ok(r);
  if (process.env.PDF_OUT) (await import("node:fs")).writeFileSync(process.env.PDF_OUT, r.pdf);
  const t = r.pdf.toString("latin1");
  assert.ok(t.startsWith("%PDF-1.4") && t.trimEnd().endsWith("%%EOF"));
  assert.match(t, /\/Count [2-9]/); assert.ok(t.includes("INV-0001") && t.includes("Rs. 1,180.00"));
  const xref = Number(/startxref\n(\d+)/.exec(t)[1]); assert.equal(t.slice(xref, xref + 4), "xref");
  assert.equal(r.filename, "TAX-INVOICE-INV-0001.pdf");
});
test("prescription renders; missing record returns null", async () => {
  assert.ok((await buildDocPdf(fake, "rx", "r1")).pdf.length > 500);
  assert.equal(await buildDocPdf({ from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null }) }; return q; } }, "sale", "x"), null);
});
