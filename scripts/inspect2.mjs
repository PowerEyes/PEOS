import { sb, log } from "./db.mjs";

// column introspection via RPC-free approach: select one row with *
log("--- profiles ---");
{
  const { data, error } = await sb.from("profiles").select("*").limit(10);
  log(error ? "ERR " + error.message : JSON.stringify(data, null, 1));
}
log("\n--- information_schema tables (public) ---");
{
  const { data, error } = await sb.rpc("exec_sql", { query: "select 1" });
  log("exec_sql rpc: " + (error ? "not available: " + error.message : JSON.stringify(data)));
}
log("\n--- finance-ish tables guess ---");
for (const t of ["finance_transactions", "transactions", "ledger_entries", "cashbook", "cashbook_entries", "journal_entries", "expenses", "accounts", "payments", "sales_orders", "orders"]) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  log(`${t}: ${error ? "—" : "count=" + count}`);
}
