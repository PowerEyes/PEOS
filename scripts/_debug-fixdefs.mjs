// Dump defs needed by the fix migration.
import { readFileSync } from "node:fs";

const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));
const prod = JSON.parse(readFileSync("docs/sql/snapshots/prod.json", "utf8"));

const con = (snap, table, name) =>
  snap.constraints.find((c) => c.table === table && c.name === name);
const col = (snap, table, name) =>
  snap.columns.find((c) => c.table === table && c.name === name);

console.log("=== fresh-only constraint defs (targets) ===");
for (const [t, n] of [
  ["family_members", "family_members_customer_id_fkey"],
  ["lens_packages", "lens_packages_design_check"],
  ["role_permissions", "role_permissions_permission_fkey"],
]) {
  const c = con(fresh, t, n);
  console.log(`  ${t}#${n} = ${c ? c.def : "NOT FOUND"}`);
  const c2 = con(prod, t, n);
  console.log(`    (prod has it: ${c2 ? "yes" : "no"})`);
}

console.log("\n=== role_permissions.id (fresh) ===");
console.log(JSON.stringify(col(fresh, "role_permissions", "id")));
console.log("=== role_permissions.id (prod) ===");
console.log(JSON.stringify(col(prod, "role_permissions", "id")));

console.log("\n=== role_permissions constraints (prod vs fresh) ===");
console.log("prod:", prod.constraints.filter((c) => c.table === "role_permissions").map((c) => `${c.name}:${c.def}`));
console.log("fresh:", fresh.constraints.filter((c) => c.table === "role_permissions").map((c) => `${c.name}:${c.def}`));

console.log("\n=== family_members 6 fresh-only cols (defs) ===");
for (const n of ["customer_id", "name", "dob", "gender", "phone", "notes"]) {
  const c = col(fresh, "family_members", n);
  console.log(`  ${n}: type=${c.type} not_null=${c.not_null} default=${JSON.stringify(c.default)}`);
}

console.log("\n=== family_members prod-side cols (for backfill awareness) ===");
for (const n of ["primary_customer_id", "member_customer_id", "member_label", "is_active", "relationship", "created_at"]) {
  const p = col(prod, "family_members", n);
  const f = col(fresh, "family_members", n);
  console.log(`  ${n}: prod=${p ? `nn=${p.not_null} d=${JSON.stringify(p.default)}` : "ABSENT"} fresh=${f ? `nn=${f.not_null} d=${JSON.stringify(f.default)}` : "ABSENT"}`);
}

console.log("\n=== lab_orders / sales patient FK + cart FKs (target defs) ===");
for (const [t, n] of [
  ["lab_orders", "lab_orders_patient_customer_id_fkey"],
  ["sales", "sales_patient_customer_id_fkey"],
  ["cart_items", "cart_items_product_id_fkey"],
  ["cart_items", "cart_items_customer_id_fkey"],
  ["family_members", "family_members_org_id_fkey"],
]) {
  console.log(`  ${t}#${n}:\n    fresh = ${con(fresh, t, n)?.def}\n    prod  = ${con(prod, t, n)?.def}`);
}
