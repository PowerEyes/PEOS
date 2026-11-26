import { sb, log } from "./db.mjs";
const { data, error } = await sb.from("purchase_invoices").select("*").limit(2);
log(error ? "ERR " + error.message : JSON.stringify(data, null, 1));
log("\n--- cashbook ---");
const c = await sb.from("cashbook").select("*").limit(10);
log(c.error ? "ERR " + c.error.message : JSON.stringify(c.data, null, 1));
log("\n--- payments ---");
const p = await sb.from("payments").select("*").limit(10);
log(p.error ? "ERR " + p.error.message : JSON.stringify(p.data, null, 1));
