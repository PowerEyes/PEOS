// Removes the products created by seed_products.mjs in this session so the
// seed can be re-run with brands fixed. Safe: these rows have no sales yet.
import { sb, log } from "./db.mjs";

const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const { data: ids } = await sb.from("products").select("id").gte("created_at", since);
const list = (ids ?? []).map((r) => r.id);
log(`products to remove: ${list.length}`);
if (!list.length) process.exit(0);

const { count: refs } = await sb.from("sale_lines").select("id", { count: "exact", head: true }).in("product_id", list);
log(`sale_lines referencing them: ${refs}`);
if (refs) { log("ABORT — products are referenced by sales."); process.exit(1); }

for (let i = 0; i < list.length; i += 100) {
  const chunk = list.slice(i, i + 100);
  const m = await sb.from("stock_movements").delete().in("product_id", chunk);
  if (m.error) { log("movements delete failed: " + m.error.message); process.exit(1); }
  const s = await sb.from("stock").delete().in("product_id", chunk);
  if (s.error) { log("stock delete failed: " + s.error.message); process.exit(1); }
  const p = await sb.from("products").delete().in("id", chunk);
  if (p.error) { log("products delete failed: " + p.error.message); process.exit(1); }
}
const { count: left } = await sb.from("products").select("id", { count: "exact", head: true }).gte("created_at", since);
log(`remaining seeded products: ${left}`);
