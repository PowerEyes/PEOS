// Print the exact changed / fresh-only key lists for the fix migration.
// Replicates sql-schema-diff.mjs flt + row comparison exactly.
import { readFileSync } from "node:fs";

const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));
const prod = JSON.parse(readFileSync("docs/sql/snapshots/prod.json", "utf8"));

const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
const flt = (rows) =>
  rows.filter((r) => {
    const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? "");
    return !PLATFORM_RE.test(t);
  });

const M = (rows, key) => new Map(flt(rows).map((r) => [key(r), r]));
const kCol = (r) => `${r.table}.${r.name}`;
const kCon = (r) => `${r.table}#${r.name}`;
const kPol = (r) => `${r.table}.${r.name}`;
const kFn = (r) => `${r.name}(${r.args})`;

const cmp = (label, aRows, bRows, key) => {
  const a = M(aRows, key), b = M(bRows, key);
  const changed = [...b.keys()].filter((k) => a.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
  const freshOnly = [...b.keys()].filter((k) => !a.has(k));
  const upgOnly = [...a.keys()].filter((k) => !b.has(k));
  console.log(`\n== ${label}: changed=${changed.length} freshOnly=${freshOnly.length} upgradeOnly=${upgOnly.length}`);
  for (const k of changed) {
    const av = a.get(k), bv = b.get(k);
    const diffs = Object.keys(bv).filter((f) => JSON.stringify(av[f]) !== JSON.stringify(bv[f]));
    console.log(`  CHANGED ${k}  [${diffs.join(",")}]`);
    for (const f of diffs) console.log(`      ${f}: upg=${JSON.stringify(av[f])} fresh=${JSON.stringify(bv[f])}`);
  }
  for (const k of freshOnly) console.log(`  FRESH-ONLY ${k}`);
  for (const k of upgOnly) console.log(`  UPGRADE-ONLY ${k}`);
  return { changed, freshOnly, upgOnly };
};

cmp("columns", upg.columns, fresh.columns, kCol);
cmp("constraints", upg.constraints, fresh.constraints, kCon);
cmp("policies", upg.policies, fresh.policies, kPol);
cmp("functions", upg.functions, fresh.functions, kFn);
cmp("indexes", upg.indexes, fresh.indexes, (r) => `${r.table}#${r.name}`);
cmp("triggers", upg.triggers, fresh.triggers, (r) => `${r.table}.${r.name}`);
cmp("views", upg.views, fresh.views, (r) => r.name);
cmp("grants(prod vs fresh)", prod.grants, fresh.grants, (r) => `${r.table}->${r.grantee}`);
// ground-truth cross-check: do prod-vs-fresh changed lists match upgrade-vs-fresh?
console.log("\n=== prod vs fresh cross-check (changed only) ===");
cmp("P columns", prod.columns, fresh.columns, kCol);
cmp("P constraints", prod.constraints, fresh.constraints, kCon);
cmp("P policies", prod.policies, fresh.policies, kPol);
cmp("P functions", prod.functions, fresh.functions, kFn);
