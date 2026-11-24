// Schema drift analysis: compare what the SQL files claim with what the live
// production database actually contains.
//
//   node scripts/sql-drift.mjs        -> prints report, writes docs/sql/drift.json
//
// For every migration file it checks how many of the objects it *creates* are
// present in the live schema (=> applied / pending / partially applied), and it
// reports public-schema live objects that no file declares (=> candidate manual
// drift). Platform schemas (auth, storage, realtime, vault, supabase_migrations)
// are matched for verdicts but never reported as orphans — Supabase owns them.
//
// NOTE: policies/functions created dynamically inside DO blocks are invisible to
// static parsing, so `orphanLive` entries are *candidates* that must be confirmed
// against the authoritative DB-vs-DB diff (scripts/sql-schema-diff.mjs).

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const INV = join(ROOT, "docs", "sql", "inventory.json");
const OUT = join(ROOT, "docs", "sql", "drift.json");

const dsn = process.env.DATABASE_URL ??
  "postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

const db = new pg.Client({ connectionString: dsn, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (sql, params = []) => (await db.query(sql, params)).rows;

const inv = JSON.parse(await readFile(INV, "utf8"));

// keys are qualified unless the object lives in public (files are unqualified
// for public because classify() strips the public. prefix)
const key = (s, n) => (s === "public" ? n : `${s}.${n}`);

/** rows -> { all: Set, pub: Set } (pub = orphan-reportable, app schema only) */
const mkSet = (rows, keyOf) => ({
  all: new Set(rows.map(keyOf)),
  pub: new Set(rows.filter((r) => r.__schema === "public").map(keyOf)),
});

const notSystem = `table_schema not in ('pg_catalog','information_schema')`;
const tables = await q(`select table_schema as __schema, table_name as name from information_schema.tables where table_type='BASE TABLE' and ${notSystem}`);
const liveTables = mkSet(tables, (r) => key(r.__schema, r.name));

const cols = await q(`select table_schema as __schema, table_name, column_name from information_schema.columns where ${notSystem}`);
const liveColumns = mkSet(cols, (r) => key(r.__schema, `${r.table_name}.${r.column_name}`));

// only user-created (non constraint-backed) indexes are expected from files
const idx = await q(`select n.nspname as __schema, c.relname as indexname
  from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and not i.indisprimary
    and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)`);
const liveIndexes = mkSet(idx, (r) => key(r.__schema, r.indexname));

const fns = await q(`select n.nspname as __schema, p.proname
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname not in ('pg_catalog','information_schema')`);
const liveFunctions = mkSet(fns, (r) => key(r.__schema, r.proname));

const views = await q(`select table_schema as __schema, table_name as name from information_schema.views where ${notSystem}`);
const liveViews = mkSet(views, (r) => key(r.__schema, r.name));

const trigs = await q(`select n.nspname as __schema, c.relname as tbl, t.tgname
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema') and not t.tgisinternal`);
const liveTriggers = mkSet(trigs, (r) => key(r.__schema, `${r.tbl}.${r.tgname}`));

const pols = await q(`select schemaname as __schema, tablename, policyname from pg_policies
  where schemaname not in ('pg_catalog','information_schema')`);
const livePolicies = mkSet(pols, (r) => key(r.__schema, `${r.tablename}.${r.policyname}`));

const existsInLive = (kind, object) => {
  const o = String(object).toLowerCase();
  switch (kind) {
    case "table": return liveTables.all.has(o);
    case "column": return liveColumns.all.has(o);
    case "index": return liveIndexes.all.has(o);
    case "function": return liveFunctions.all.has(o);
    case "view": return liveViews.all.has(o);
    case "trigger": return liveTriggers.all.has(o);
    case "policy": return livePolicies.all.has(o);
    default: return null; // type/sequence/extension/schema not tracked here
  }
};

// ── per-file evidence ───────────────────────────────────────────────────────
const fileReport = [];
for (const f of inv.files) {
  if (f.dir !== "migrations" && f.dir !== "disabled") continue;
  const tracked = f.objects.filter((o) => ["create", "add"].includes(o.action) && existsInLive(o.kind, o.object) !== null);
  const present = [];
  const absent = [];
  for (const o of tracked) {
    (existsInLive(o.kind, o.object) ? present : absent).push(`${o.kind}:${o.object}`);
  }
  const total = present.length + absent.length;
  const ratio = total ? present.length / total : 1;
  fileReport.push({
    file: f.file, dir: f.dir, version: f.version, applied: f.applied,
    tracked: total, present: present.length, absent: absent.length,
    ratio: Math.round(ratio * 100) / 100,
    verdict: f.dir === "disabled" ? "DISABLED"
      : f.applied ? (absent.length ? "APPLIED_WITH_GAPS" : "APPLIED_OK")
        : ratio >= 0.9 ? "APPLIED_BUT_UNRECORDED"
          : ratio === 0 ? "PENDING"
            : "PARTIAL",
    missing: absent.slice(0, 30),
    extraMissing: absent.length > 30 ? absent.length - 30 : 0,
  });
}

// ── public-schema live objects that no file declares ────────────────────────
const defined = new Map(); // key -> [files]
const def = (keyV, file) => {
  if (!defined.has(keyV)) defined.set(keyV, []);
  defined.get(keyV).push(file);
};
const parsedColumns = new Map(); // table -> columns when create-table body parsed
for (const f of inv.files) {
  for (const o of f.objects) {
    if (!["create", "add", "enable"].includes(o.action)) continue;
    def(`${o.kind}:${String(o.object).toLowerCase()}`, f.file);
    if (o.kind === "table" && o.columns?.length) {
      parsedColumns.set(String(o.object).toLowerCase(), o.columns);
      for (const c of o.columns) def(`column:${String(o.object).toLowerCase()}.${c}`, f.file);
    }
  }
}

const orphanLive = [];
for (const t of liveTables.pub) {
  if (!defined.has(`table:${t}`)) orphanLive.push({ kind: "table", object: t });
}
for (const c of liveColumns.pub) {
  if (defined.has(`column:${c}`)) continue;
  const tbl = c.split(".").slice(0, -1).join(".");
  if (!liveTables.pub.has(tbl)) continue;              // already reported as orphan table
  if (!defined.has(`table:${tbl}`)) continue;
  if (!parsedColumns.has(tbl)) continue;               // create body unparsed -> can't judge
  orphanLive.push({ kind: "column", object: c, note: "table declared by a file, column not declared anywhere" });
}
for (const i of liveIndexes.pub) if (!defined.has(`index:${i}`)) orphanLive.push({ kind: "index", object: i });
for (const fn of liveFunctions.pub) if (!defined.has(`function:${fn}`)) orphanLive.push({ kind: "function", object: fn });
for (const v of liveViews.pub) if (!defined.has(`view:${v}`)) orphanLive.push({ kind: "view", object: v });
for (const t of liveTriggers.pub) if (!defined.has(`trigger:${t}`)) orphanLive.push({ kind: "trigger", object: t });
for (const p of livePolicies.pub) if (!defined.has(`policy:${p}`)) orphanLive.push({ kind: "policy", object: p });

const result = {
  generatedAt: new Date().toISOString(),
  liveCounts: {
    allSchemas: {
      tables: liveTables.all.size, columns: liveColumns.all.size, indexes: liveIndexes.all.size,
      functions: liveFunctions.all.size, views: liveViews.all.size, triggers: liveTriggers.all.size, policies: livePolicies.all.size,
    },
    publicOnly: {
      tables: liveTables.pub.size, columns: liveColumns.pub.size, indexes: liveIndexes.pub.size,
      functions: liveFunctions.pub.size, views: liveViews.pub.size, triggers: liveTriggers.pub.size, policies: livePolicies.pub.size,
    },
  },
  files: fileReport,
  orphanLive,
};
await mkdir(join(ROOT, "docs", "sql"), { recursive: true });
await writeFile(OUT, JSON.stringify(result, null, 1));

const byVerdict = fileReport.reduce((a, f) => ((a[f.verdict] = (a[f.verdict] ?? 0) + 1), a), {});
console.log("live schema:", JSON.stringify(result.liveCounts));
console.log("file verdicts:", JSON.stringify(byVerdict));
console.log("\nFiles with problems:");
for (const f of fileReport.filter((f) => !["APPLIED_OK", "DISABLED"].includes(f.verdict))) {
  console.log(`  [${f.verdict}] ${f.file}  (${f.present}/${f.tracked} objects present${f.applied ? ", in ledger" : ", NOT in ledger"})`);
  if (f.missing.length) console.log(`      missing: ${f.missing.slice(0, 8).join(", ")}${f.extraMissing ? ` (+${f.extraMissing})` : ""}`);
}
console.log(`\nlive public objects not declared by any file: ${orphanLive.length}`);
const byKind = orphanLive.reduce((a, o) => ((a[o.kind] = (a[o.kind] ?? 0) + 1), a), {});
console.log("  by kind:", JSON.stringify(byKind));
for (const o of orphanLive.slice(0, 60)) console.log(`  ${o.kind}: ${o.object}${o.note ? "  -- " + o.note : ""}`);
if (orphanLive.length > 60) console.log(`  ... +${orphanLive.length - 60} more`);
console.log(`\nwritten: ${relative(ROOT, OUT).replace(/\\/g, "/")}`);
await db.end();
