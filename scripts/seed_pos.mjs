// Creates one draft purchase order per supplier per branch (15 × 2 = 30 POs),
// covering all 375 seeded products, 10 units per line.
// Run: node scripts/seed_pos.mjs
import { sb, log } from "./db.mjs";
import { buildCatalog, supplierChunks, SUPPLIERS, BRANCH, QTY, ORG_ID } from "./data.mjs";

const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

const { data: existing } = await sb.from("purchase_orders").select("po_no").gte("created_at", since);
if (existing?.length) { log(`ABORT: ${existing.length} PO(s) already seeded.`); process.exit(0); }

const { data: prods, error: pe } = await sb.from("products")
  .select("id,kind,power_eligible,model,selling_price,cost_price,tax_pct,hsn,sku")
  .gte("created_at", since);
if (pe) { log("product select failed: " + pe.message); process.exit(1); }
log(`seeded products found: ${prods.length}`);

const key = (r) => `${r.kind}|${r.power_eligible}|${r.model}|${Number(r.selling_price)}`;
const byKey = new Map(prods.map((p) => [key(p), p]));

const rows = buildCatalog();
const missing = rows.filter((r) => !byKey.has(key(r)));
if (missing.length) { log(`ABORT: ${missing.length} catalogue rows have no product row (e.g. ${missing[0].model})`); process.exit(1); }

const { data: supRows, error: se } = await sb.from("suppliers").select("id,name,gstin");
if (se) { log("supplier select failed: " + se.message); process.exit(1); }
const supByName = new Map(supRows.map((s) => [s.name, s]));

const { data: profiles } = await sb.from("profiles").select("id").eq("role_key", "owner").eq("is_approved", true).order("created_at", { ascending: false }).limit(1);
const createdBy = profiles?.[0]?.id ?? null;

const chunks = supplierChunks(rows); // 15 chunks × 25 products
const today = new Date().toISOString().slice(0, 10);
const expected = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const r2 = (n) => Math.round(n * 100) / 100;
let created = 0;
for (let i = 0; i < SUPPLIERS.length; i++) {
  const sup = supByName.get(SUPPLIERS[i].name);
  if (!sup) { log(`ABORT: supplier ${SUPPLIERS[i].name} missing`); process.exit(1); }
  const lines = chunks[i].map((row) => {
    const p = byKey.get(key(row));
    return {
      product_id: p.id, sku: p.sku,
      description: `${row.brand} ${row.model}`, hsn: row.hsn,
      qty: QTY, rate: Number(p.cost_price), tax_pct: Number(p.tax_pct), received_qty: 0,
    };
  });
  let sub = 0, cgst = 0, sgst = 0, igst = 0;
  for (const l of lines) {
    const taxable = l.qty * l.rate; const tax = taxable * l.tax_pct / 100;
    sub += taxable; cgst += tax / 2; sgst += tax / 2;
  }
  const totals = {
    subtotal: r2(sub), taxable_value: r2(sub), cgst_amount: r2(cgst), sgst_amount: r2(sgst),
    igst_amount: r2(igst), grand_total: r2(sub + cgst + sgst + igst),
  };

  for (const branch of [BRANCH.east, BRANCH.west]) {
    const { data, error } = await sb.from("purchase_orders").insert({
      org_id: ORG_ID, branch_id: branch.id, supplier_id: sup.id,
      supplier_name: sup.name, supplier_gstin: sup.gstin,
      order_date: today, expected_date: expected, supply_type: "intrastate",
      lines, status: "draft", notes: `Seeded PO — ${SUPPLIERS[i].name} → ${branch.name}`,
      ...totals, created_by: createdBy,
    }).select("id, po_no").single();
    if (error) { log(`PO insert failed for ${sup.name}/${branch.name}: ${error.message}`); process.exit(1); }
    created++;
    log(`created ${data.po_no} — ${sup.name} → ${branch.name} (${lines.length} lines, ₹${totals.grand_total})`);
  }
}
log(`TOTAL POs created: ${created}`);

const { data: count } = await sb.from("purchase_orders").select("status");
const agg = {}; for (const p of count ?? []) agg[p.status] = (agg[p.status] ?? 0) + 1;
log("status summary: " + JSON.stringify(agg));
