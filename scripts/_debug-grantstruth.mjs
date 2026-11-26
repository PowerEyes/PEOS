// ground-truth grant analysis: prod.json vs fresh.json (NOT the shim-contaminated upgrade.json)
import { readFileSync } from "node:fs";

const prod = JSON.parse(readFileSync("docs/sql/snapshots/prod.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));

const maint = (s) => (s.grants ?? []).filter((g) => String(g.privs).includes("MAINTAIN")).length;
console.log("prod grants with MAINTAIN:", maint(prod), "| fresh:", maint(fresh));

const key = (g) => `${g.table}->${g.grantee}`;
const pm = new Map((prod.grants ?? []).map((g) => [key(g), g.privs]));
const fm = new Map((fresh.grants ?? []).map((g) => [key(g), g.privs]));

const extra = [...pm.keys()].filter((k) => !fm.has(k));
const missing = [...fm.keys()].filter((k) => !pm.has(k));
const changed = [...pm.keys()].filter((k) => fm.has(k) && pm.get(k) !== fm.get(k));

console.log(`\nEXTRA in prod (prod has, fresh lacks): ${extra.length}`);
for (const k of extra) console.log(`  ${k} = ${pm.get(k)}`);
console.log(`\nMISSING in prod (fresh has, prod lacks): ${missing.length}`);
for (const k of missing.slice(0, 40)) console.log(`  ${k} = ${fm.get(k)}`);
console.log(`\nCHANGED: ${changed.length}`);
for (const k of changed) console.log(`  ${k}\n    prod  = ${pm.get(k)}\n    fresh = ${fm.get(k)}`);
