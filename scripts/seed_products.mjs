// Creates the 375 catalogue products (50 Rx frames, 50 non-Rx frames, 50 Rx
// sunglasses, 50 non-Rx sunglasses, 50 accessories, 5×25 contact lenses).
// Run: node scripts/seed_products.mjs
import { sb, log } from "./db.mjs";
import { buildCatalog, SUPPLIERS } from "./data.mjs";

const rows = buildCatalog();
log(`catalogue rows: ${rows.length}`);

// Idempotency: refuse to seed twice within an hour.
const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const { count: existing } = await sb.from("products").select("id", { count: "exact", head: true }).gte("created_at", since);
if (existing) { log(`ABORT: ${existing} product(s) were created in the last hour — already seeded.`); process.exit(0); }

// Brands
const { data: brandRows, error: be } = await sb.from("brands").select("id, name");
if (be) { log("brand select failed: " + be.message); process.exit(1); }
const brandId = new Map(brandRows.map((b) => [b.name, b.id]));
const wanted = [...new Set(rows.map((r) => r.brand))];
for (const name of wanted) {
  if (brandId.has(name)) continue;
  const { data, error } = await sb.from("brands").insert({ org_id: "00000000-0000-0000-0000-000000000001", name }).select("id").single();
  if (error) { log(`brand "${name}" → ${error.message}`); continue; }
  brandId.set(name, data.id);
  log(`created brand: ${name}`);
}

// Products (SKU / barcode come from the DB trigger)
const payload = rows.map((r) => ({
  org_id: "00000000-0000-0000-0000-000000000001",
  kind: r.kind,
  brand_id: brandId.get(r.brand) ?? null,
  model: r.model, collection: r.collection, gender: r.gender,
  cost_price: r.cost_price, mrp: r.mrp, selling_price: r.selling_price, tax_pct: r.tax_pct,
  power_eligible: r.power_eligible, hsn: r.hsn, price_mode: r.price_mode,
  status: r.status, visible_on_website: r.visible_on_website,
  featured: r.featured, new_arrival: r.new_arrival, bestseller: r.bestseller,
  short_desc: r.short_desc, description: r.description, images: r.images, attrs: r.attrs,
  created_at: new Date().toISOString(),
}));

let inserted = 0;
for (let i = 0; i < payload.length; i += 75) {
  const chunk = payload.slice(i, i + 75);
  const { error } = await sb.from("products").insert(chunk);
  if (error) { log(`insert ${i}..${i + chunk.length} FAILED: ${error.message}`); process.exit(1); }
  inserted += chunk.length;
  log(`inserted ${inserted}/${payload.length}`);
}

const { data: check } = await sb.from("products").select("kind, power_eligible").gte("created_at", since);
const agg = {};
for (const p of check ?? []) {
  const k = p.kind === "frame" ? (p.power_eligible ? "prescription_frames" : "non_prescription_frames")
    : p.kind === "sunglass" ? (p.power_eligible ? "prescription_sunglasses" : "non_prescription_sunglasses")
    : p.kind === "accessory" ? "accessories" : "contact_lenses";
  agg[k] = (agg[k] ?? 0) + 1;
}
log("SEEDED: " + JSON.stringify(agg, null, 1));
log(`suppliers referenced: ${SUPPLIERS.length}`);
