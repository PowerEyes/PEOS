// Deterministic diff of two schema snapshots produced by sql-schema-snapshot.mjs.
//
//   node scripts/sql-schema-diff.mjs <a.json> <b.json> [label]
//
// a = baseline (e.g. fresh install), b = target (e.g. production).
// Output: objects missing in a, extra in a, and definitions that differ.

import { readFile } from "node:fs/promises";

const [aPath, bPath, label = "diff"] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error(`usage: node scripts/sql-schema-diff.mjs <a.json> <b.json> [label]`);
  process.exit(1);
}

const A = JSON.parse(await readFile(aPath, "utf8"));
const B = JSON.parse(await readFile(bPath, "utf8"));

const PUBLIC_ONLY = process.argv.includes("--public");
const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
// keep only app-schema rows: the table/name/singleton value must not sit in a platform schema
const flt = (rows) =>
  PUBLIC_ONLY
    ? rows.filter((r) => {
        const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? "");
        return !PLATFORM_RE.test(t);
      })
    : rows;

const report = {};
let totalMissing = 0, totalExtra = 0, totalChanged = 0;

const idx = (rows, keyOf, valOf = (x) => x) => {
  const m = new Map();
  for (const r of rows) m.set(keyOf(r), valOf(r));
  return m;
};

function cmp(name, aRows, bRows, keyOf, valOf, showLimit = 500) {
  const a = idx(aRows, keyOf, valOf);
  const b = idx(bRows, keyOf, valOf);
  const missing = [...b.keys()].filter((k) => !a.has(k));   // in b, not in a
  const extra = [...a.keys()].filter((k) => !b.has(k));     // in a, not in b
  const changed = [...b.keys()].filter((k) => a.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
  totalMissing += missing.length; totalExtra += extra.length; totalChanged += changed.length;
  report[name] = {
    a: aRows.length, b: bRows.length,
    missingInA: missing.slice(0, showLimit).map((k) => ({ key: k, b: b.get(k), a: a.get(k) ?? null })),
    missingCount: missing.length,
    extraInA: extra.slice(0, showLimit).map((k) => ({ key: k, a: a.get(k), b: b.get(k) ?? null })),
    extraCount: extra.length,
    changed: changed.slice(0, showLimit).map((k) => ({ key: k, a: a.get(k), b: b.get(k) })),
    changedCount: changed.length,
  };
}

cmp("tables", flt(A.tables ?? []), flt(B.tables ?? []), (r) => r.name, (r) => ({ rls: r.rls, forced: r.forced_rls }));
cmp("columns", flt(A.columns ?? []), flt(B.columns ?? []), (r) => `${r.table}.${r.name}`,
  (r) => ({ type: r.type, not_null: r.not_null, default: r.default, identity: r.identity, generated: r.generated }));
cmp("constraints", flt(A.constraints ?? []), flt(B.constraints ?? []), (r) => `${r.table}#${r.name}`, (r) => `${r.type}: ${r.def}`);
cmp("indexes", flt(A.indexes ?? []), flt(B.indexes ?? []), (r) => r.name, (r) => ({ table: r.table, primary: r.primary, unique: r.unique, def: r.def }));
cmp("triggers", flt(A.triggers ?? []), flt(B.triggers ?? []), (r) => `${r.table}.${r.name}`, (r) => r.def);
cmp("functions", flt(A.functions ?? []), flt(B.functions ?? []), (r) => `${r.name}(${r.args})`,
  (r) => ({ returns: r.returns, lang: r.language, vol: r.volatility, secdef: r.security_definer, def: r.def }));
cmp("views", flt(A.views ?? []), flt(B.views ?? []), (r) => r.name, (r) => r.def);
cmp("policies", flt(A.policies ?? []), flt(B.policies ?? []), (r) => `${r.table}.${r.name}`,
  (r) => ({ cmd: r.cmd, permissive: r.permissive, roles: r.roles, qual: r.qual, with_check: r.with_check }));
cmp("grants", flt(A.grants ?? []), flt(B.grants ?? []), (r) => `${r.table}->${r.grantee}`, (r) => r.privs);
cmp("sequences", flt(A.sequences ?? []), flt(B.sequences ?? []), (r) => r, () => ({}));
cmp("types", flt(A.types ?? []), flt(B.types ?? []), (r) => r.name, (r) => r.labels);
cmp("extensions", flt((A.extensions ?? []).map((e) => ({ name: e }))), flt((B.extensions ?? []).map((e) => ({ name: e }))), (r) => r.name, () => ({}));

const concise = {};
for (const [k, v] of Object.entries(report)) {
  if (v.missingCount || v.extraCount || v.changedCount) {
    concise[k] = { missingInA: v.missingCount, extraInA: v.extraCount, changed: v.changedCount };
  }
}

console.log(`# ${label}`);
console.log(`a=${aPath}`);
console.log(`b=${bPath}`);
console.log(`missing in a (present in b): ${totalMissing}   extra in a: ${totalExtra}   definition differs: ${totalChanged}`);
console.log(`\nby object type:`);
for (const [k, v] of Object.entries(concise)) console.log(`  ${k}: ${JSON.stringify(v)}`);
if (!Object.keys(concise).length) console.log("  (identical)");

const detail = process.argv.includes("--detail");
if (detail) {
  for (const [k, v] of Object.entries(report)) {
    if (!v.missingCount && !v.extraCount && !v.changedCount) continue;
    console.log(`\n## ${k}`);
    if (v.missingCount) {
      console.log(`  -- in b but NOT in a (${v.missingCount}):`);
      for (const it of v.missingInA) console.log(`     ${it.key}${v.missingInA.length ? "  " + JSON.stringify(it.b).slice(0, 200) : ""}`);
      if (v.missingCount > v.missingInA.length) console.log(`     ... +${v.missingCount - v.missingInA.length} more`);
    }
    if (v.extraCount) {
      console.log(`  -- in a but NOT in b (${v.extraCount}):`);
      for (const it of v.extraInA) console.log(`     ${it.key}`);
      if (v.extraCount > v.extraInA.length) console.log(`     ... +${v.extraCount - v.extraInA.length} more`);
    }
    if (v.changedCount) {
      console.log(`  -- definition differs (${v.changedCount}):`);
      for (const it of v.changed.slice(0, 10)) {
        console.log(`     ${it.key}`);
        console.log(`        a: ${JSON.stringify(it.a).slice(0, 300)}`);
        console.log(`        b: ${JSON.stringify(it.b).slice(0, 300)}`);
      }
      if (v.changedCount > 10) console.log(`     ... +${v.changedCount - 10} more`);
    }
  }
}
