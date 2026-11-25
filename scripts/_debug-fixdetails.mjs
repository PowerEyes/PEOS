// Print detail lines (upg vs fresh field values) for the upgrade-vs-fresh changed keys.
import { readFileSync } from "node:fs";

const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));

const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
const flt = (rows) =>
  rows.filter((r) => {
    const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? "");
    return !PLATFORM_RE.test(t);
  });

const M = (rows, key) => new Map(flt(rows).map((r) => [key(r), r]));

const show = (label, aRows, bRows, key, fields) => {
  const a = M(aRows, key), b = M(bRows, key);
  const changed = [...b.keys()].filter((k) => a.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
  console.log(`\n== ${label} (${changed.length})`);
  for (const k of changed) {
    const av = a.get(k), bv = b.get(k);
    console.log(`  ${k}`);
    for (const f of fields) {
      if (JSON.stringify(av[f]) !== JSON.stringify(bv[f])) {
        console.log(`    ${f}:\n      upg  = ${JSON.stringify(av[f])}\n      fresh= ${JSON.stringify(bv[f])}`);
      }
    }
  }
};

show("columns", upg.columns, fresh.columns, (r) => `${r.table}.${r.name}`, ["type", "not_null", "default"]);
show("constraints", upg.constraints, fresh.constraints, (r) => `${r.table}#${r.name}`, ["def"]);
show("policies", upg.policies, fresh.policies, (r) => `${r.table}.${r.name}`, ["roles", "cmd", "permissive", "qual", "with_check"]);
