import { sb, log } from "./db.mjs";

async function table(name, cols = "*", opts = {}) {
  let q = sb.from(name).select(cols, { count: "exact", head: false });
  if (opts.limit) q = q.limit(opts.limit);
  if (opts.order) q = q.order(opts.order[0], { ascending: opts.order[1] ?? true });
  const { data, error, count } = await q;
  if (error) return log(`${name}: ERROR ${error.message}`);
  log(`\n== ${name} (count=${count}) ==`);
  for (const r of data ?? []) log(JSON.stringify(r));
}

log("--- organizations ---");
await table("organizations");
log("\n--- branches ---");
await table("branches");
log("\n--- profiles ---");
await table("profiles", "id,email,org_id,branch_id,role,full_name", { limit: 20 });
log("\n--- suppliers ---");
await table("suppliers", "id,name,gstin,state,status", { limit: 20 });
log("\n--- products by kind ---");
{
  const { data, error } = await sb.from("products").select("kind, status, visible_on_website, power_eligible");
  if (error) log("products err", error.message);
  else {
    const agg = {};
    for (const p of data) {
      const k = `${p.kind}|${p.status}|web=${p.visible_on_website}|rx=${p.power_eligible}`;
      agg[k] = (agg[k] ?? 0) + 1;
    }
    log(JSON.stringify(agg, null, 2));
  }
}
log("\n--- stock rows ---");
{
  const { data, error } = await sb.from("stock").select("branch_id, product_id, qty").limit(1000);
  if (error) log("stock err", error.message);
  else {
    const agg = {};
    for (const s of data) agg[s.branch_id] = (agg[s.branch_id] ?? 0) + s.qty;
    log(`rows=${data.length} qtyByBranch=${JSON.stringify(agg)}`);
  }
}
log("\n--- purchase_invoices ---");
await table("purchase_invoices", "id,invoice_no,supplier_name,branch_id,grand_total,paid_amount,status,stock_posted_at", { limit: 20 });
log("\n--- stock_movements recent ---");
await table("stock_movements", "id,branch_id,product_id,delta,reason,note,created_at", { limit: 10, order: ["id", false] });
log("\n--- brands ---");
await table("brands", "id,name", { limit: 50 });
