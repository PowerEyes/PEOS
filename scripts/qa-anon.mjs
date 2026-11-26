// QA helper: query the Supabase REST API with the *anon* key only (no session),
// i.e. exactly what an unauthenticated attacker can do. Usage:
//   node scripts/qa-anon.mjs "customers" "id,full_name"
//   node scripts/qa-anon.mjs "customers" "*"  --filter=org_id=eq.00000000-0000-0000-0000-000000000002
import { createRequire } from "node:module";
const require = createRequire(import.meta.url + "/../../apps/erp/");
const { createClient } = require("@supabase/supabase-js");

const table = process.argv[2];
const cols = process.argv[3] ?? "*";
const filterArg = process.argv.find((a) => a.startsWith("--filter="));
const filter = filterArg ? filterArg.slice("--filter=".length) : undefined;

const anon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub2Fnbm9id3JwdGJjZGVzaGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTAyNzQsImV4cCI6MjEwNjE4NjI3NH0._55qZngaaUdWHgv4vVlzqw4IURGiPCjB0CI-_WDcqQU";

const c = createClient("https://lnoagnobwrptbcdeshji.supabase.co", anon, { auth: { persistSession: false } });
let q = c.from(table).select(cols);
if (filter) {
  const i = filter.indexOf("=");
  const col = filter.slice(0, i);
  const rest = filter.slice(i + 1); // "eq.uuid" | "value" (implies eq)
  const j = rest.indexOf(".");
  const op = j === -1 ? "eq" : rest.slice(0, j);
  const val = j === -1 ? rest : rest.slice(j + 1);
  if (op === "eq") q = q.eq(col, val);
  else if (op === "neq") q = q.neq(col, val);
  else if (op === "is") q = q.is(col, val);
  else throw new Error("unsupported op " + op);
}
const { data, error } = await q.limit(10);
if (error) console.log("ERROR", error.code, error.message);
else console.log("ROWS", JSON.stringify(data));
