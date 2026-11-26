import { sb, log } from "./db.mjs";
const { data } = await sb.from("products").select("id,kind,sku,model,selling_price,visible_on_website");
log(JSON.stringify(data, null, 1));
// are they referenced by sales / movements?
for (const p of data ?? []) {
  const m = await sb.from("stock_movements").select("id", { count: "exact", head: true }).eq("product_id", p.id);
  const s = await sb.from("sale_lines").select("id", { count: "exact", head: true }).eq("product_id", p.id);
  log(`${p.sku} ${p.model}: movements=${m.count} sale_lines=${s.count} err=${m.error?.message ?? s.error?.message ?? ""}`);
}
const sl = await sb.from("sale_lines").select("id, product_id").limit(5);
log("sale_lines sample: " + JSON.stringify(sl.data) + " err=" + (sl.error?.message ?? ""));
