import { sb, log } from "./db.mjs";
const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { data } = await sb.from("products").select("kind, power_eligible, sku, brand_id, selling_price, cost_price, visible_on_website, attrs").gte("created_at", since);
const agg = {}; let noBrand = 0, notWeb = 0; const skus = new Set(); let dupSku = 0;
for (const p of data) {
  const k = `${p.kind}|rx=${p.power_eligible}`; agg[k] = (agg[k] ?? 0) + 1;
  if (!p.brand_id) noBrand++;
  if (!p.visible_on_website) notWeb++;
  if (skus.has(p.sku)) dupSku++; else skus.add(p.sku);
}
log(`total=${data.length} duplicateSkus=${dupSku} noBrand=${noBrand} notOnWebsite=${notWeb}`);
log(JSON.stringify(agg, null, 1));
const lens = data.filter((p) => p.kind === "contact_lens");
const types = {};
for (const l of lens) types[l.attrs?.lens_type] = (types[l.attrs?.lens_type] ?? 0) + 1;
log("lens types: " + JSON.stringify(types));
const shapes = new Set(data.filter((p) => p.kind === "frame").map((p) => p.attrs?.shape));
log("frame shapes: " + JSON.stringify([...shapes]));
const prices = data.map((p) => p.selling_price);
log(`price range: ${Math.min(...prices)} – ${Math.max(...prices)}`);
