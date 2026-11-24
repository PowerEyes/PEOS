// Generates supabase/migrations/20261218000000_recover_out_of_band_features.sql
//
// Materialises the production-only objects (out-of-band feature work) on fresh
// installs, extracted verbatim from docs/sql/backup/prod-schema-2026-11-24.sql
// so fresh ≡ prod. Every statement is wrapped so the file is repeat-safe on an
// existing production database (where the objects already exist).
//
// Excluded (documented in docs/sql/OPEN_ISSUES.md):
//   * stock_transfers / stock_transfer_lines / user_branches and every object
//     created by supabase/migrations/disabled/  (quarantined multi_branch model,
//     disabled/README.md: "do not ... apply them to any environment")
//   * family_members prod-only model (primary_customer_id/member_customer_id/
//     member_label ...): pending a model decision (docs/sql/OPEN_ISSUES.md)
//
// usage: node scripts/sql-build-recovery-migration.mjs

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DUMP = join(ROOT, "docs/sql/backup/prod-schema-2026-11-24.sql");
const OUT = join(ROOT, "supabase/migrations/20261218000000_recover_out_of_band_features.sql");
const TRIO = new Set(["stock_transfers", "stock_transfer_lines", "user_branches"]);
const FAMILY = new Set(["family_members"]);
const SKIP_TABLES = new Set([...TRIO, ...FAMILY]);

// ── load comparison sets ──────────────────────────────────────────────────────
const upg = JSON.parse(await readFile(join(ROOT, "docs/sql/snapshots/upgrade.json"), "utf8"));
const fresh = JSON.parse(await readFile(join(ROOT, "docs/sql/snapshots/fresh.json"), "utf8"));
const gaps = JSON.parse(await readFile(join(ROOT, "docs/sql/gaps.json"), "utf8"));

const orphan13 = new Set(
  (Array.isArray(gaps.LOST_ON_FRESH.tables) ? gaps.LOST_ON_FRESH.tables : Object.values(gaps.LOST_ON_FRESH.tables))
    .map((t) => t.key ?? t.name).filter((n) => !TRIO.has(n)),
);

const idx = (snap) => {
  const m = new Map();
  for (const [type, rows] of Object.entries(snap.objects ?? snap)) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) m.set(`${type}:${r.key}`, r);
  }
  return m;
};
// snapshots are { generatedAt, objects: { tables: [{key,...}], ... } } or flat — normalise
const objRows = (snap, type) => {
  const o = snap.objects ?? snap;
  const rows = o[type] ?? [];
  return Array.isArray(rows) ? rows : Object.entries(rows).map(([key, v]) => ({ key, ...v }));
};

const extraKeys = (type) => {
  const a = new Set(objRows(upg, type).map((r) => r.key));
  const b = new Set(objRows(fresh, type).map((r) => r.key));
  return [...a].filter((k) => !b.has(k));
};

const extraTables = new Set(extraKeys("tables"));
const extraColumns = extraKeys("columns");            // "table.column"
const extraConstraints = extraKeys("constraints");    // "table#name"
const extraIndexes = new Set(extraKeys("indexes"));   // "name"
const extraTriggers = extraKeys("triggers");          // "table.name"
const extraFunctions = new Set(extraKeys("functions").map((k) => k.replace(/\(.*$/, "")));
const extraPolicies = extraKeys("policies");          // "table.name"
const extraViews = new Set(extraKeys("views"));
const extraSequences = new Set(extraKeys("sequences"));
const extraGrantObjs = new Set(extraKeys("grants").map((k) => k.split("->")[0].replace(/\(.*$/, "")));

// ── disabled-file identifiers (never re-materialise) ─────────────────────────
const disabledIds = new Set();
const disDir = join(ROOT, "supabase/migrations/disabled");
for (const f of (await readFile(disDir + "/README.md", "utf8").catch(() => ""), [])) void f;
const { readdir } = await import("node:fs/promises");
for (const f of await readdir(disDir)) {
  if (!f.endsWith(".sql")) continue;
  const t = await readFile(join(disDir, f), "utf8");
  for (const re of [
    /create table (?:if not exists )?(?:public\.)?"?(\w+)"?/gi,
    /create or replace function (?:public\.)?"?(\w+)"?/gi,
    /create trigger "?(?:if not exists )?"?(\w+)"?/gi,
    /create policy "?(\w+)"?/gi,
    /drop policy if exists "?(\w+)"?/gi,
    /create (?:unique )?index (?:if not exists )?"?(\w+)"?/gi,
  ]) {
    let m; while ((m = re.exec(t))) disabledIds.add(m[1]);
  }
}

// ── statement splitter (dollar-quote / string / comment aware) ───────────────
function splitStatements(sql) {
  const out = [];
  let cur = "", i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); cur += sql.slice(i, j < 0 ? sql.length : j); i = j < 0 ? sql.length : j; continue; }
    if (c === "'") { let j = i + 1; while (j < sql.length) { if (sql[j] === "'" ) { if (sql[j + 1] === "'") { j += 2; continue; } break; } if (sql[j] === "\\" && sql[j+1]) j++; j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === "$") { const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i)); if (m) { const tag = m[0]; const j = sql.indexOf(tag, i + tag.length); const end = j < 0 ? sql.length - 1 : j + tag.length - 1; cur += sql.slice(i, end + 1); i = end + 1; continue; } }
    if (c === ";") { out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => s.replace(/^--.*$/gm, "").trim().length > 0);
}

const stmts = splitStatements(await readFile(DUMP, "utf8"));
console.log(`dump statements: ${stmts.length}`);
console.log(`orphan13: ${[...orphan13].join(", ")}`);
console.log(`disabled ids: ${disabledIds.size}, extra fns: ${extraFunctions.size}, policies: ${extraPolicies.length}, triggers: ${extraTriggers.length}`);

// ── classify + transform ─────────────────────────────────────────────────────
const kept = { table: [], rls: [], column: [], constraint: [], index: [], sequence: [], view: [], function: [], trigger: [], policy: [], grant: [], other: [] };
const skipped = [];
const q = (s) => `"${s}"`;

for (const st of stmts) {
  const one = st.replace(/\s+/g, " ").trim();
  let m;
  if ((m = /^CREATE TABLE IF NOT EXISTS "public"\."(\w+)"/.exec(one))) {
    (orphan13.has(m[1]) ? kept.table : skipped).push(st);
  } else if ((m = /^ALTER TABLE (?:ONLY )?"public"\."(\w+)" (ENABLE|FORCE) ROW LEVEL SECURITY/.exec(one))) {
    (orphan13.has(m[1]) ? kept.rls : skipped).push(st);
  } else if ((m = /^ALTER TABLE (?:ONLY )?"public"\."(\w+)" ADD CONSTRAINT "(\w+)"/.exec(one))) {
    const key = `${m[1]}#${m[2]}`;
    const ok = extraConstraints.includes(key) && !SKIP_TABLES.has(m[1]) && !disabledIds.has(m[2]);
    (ok ? kept.constraint : skipped).push(st);
  } else if ((m = /^CREATE (UNIQUE )?INDEX "(\w+)" ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraIndexes.has(m[2]) && !SKIP_TABLES.has(m[3]) && !disabledIds.has(m[2]);
    (ok ? kept.index : skipped).push(st);
  } else if ((m = /^CREATE SEQUENCE (IF NOT EXISTS )?"public"\."(\w+)"/.exec(one))) {
    const ok = extraSequences.has(m[2]) && !disabledIds.has(m[2]);
    (ok ? kept.sequence : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?VIEW "public"\."(\w+)"/.exec(one))) {
    (extraViews.has(m[2]) ? kept.view : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?FUNCTION "public"\."(\w+)"/.exec(one))) {
    (extraFunctions.has(m[2]) && !disabledIds.has(m[2]) ? kept.function : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?TRIGGER "(\w+)" ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraTriggers.includes(`${m[3]}.${m[2]}`) && !SKIP_TABLES.has(m[3]) && !disabledIds.has(m[2]);
    (ok ? kept.trigger : skipped).push(st);
  } else if ((m = /^CREATE POLICY "(\w+)" ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraPolicies.includes(`${m[2]}.${m[1]}`) && !SKIP_TABLES.has(m[2]) && !disabledIds.has(m[1]);
    (ok ? kept.policy : skipped).push(st);
  } else if ((m = /^(GRANT|REVOKE) [^;]+ ON (?:TABLE )?"public"\."(\w+)" TO |^(GRANT|REVOKE) [^;]+ ON FUNCTION "public"\."(\w+)"/.exec(one))) {
    const obj = m[2] ?? m[4];
    const ok = extraGrantObjs.has(obj) && !SKIP_TABLES.has(obj) && !st.includes('"public"."family_members"');
    (ok ? kept.grant : skipped).push(st);
  } else if (/^ALTER TABLE .* OWNER TO/.test(one)) {
    skipped.push(st);
  } else {
    kept.other.push(st);
  }
}

// file-table extra columns (orphan columns arrive inside CREATE TABLE)
const extraColRows = objRows(upg, "columns").filter((r) => {
  if (!extraColumns.includes(r.key)) return false;
  const t = r.key.split(".")[0];
  return !orphan13.has(t) && !SKIP_TABLES.has(t);
});
for (const r of extraColRows) {
  const [table, col] = [r.key.split(".")[0], r.key.split(".").slice(1).join(".")];
  let s = `alter table public.${table} add column if not exists ${col} ${r.type ?? "text"}`;
  if (r.default) s += ` default ${r.default}`;
  if (r.not_null) s += " not null";
  kept.column.push(s + ";");
}
console.log(`file-table extra columns: ${extraColRows.map((r) => r.key).join(", ") || "(none)"}`);
console.log(`other statements (comments/roles/etc, not needed): ${kept.other.length}`);
const otherSample = kept.other.map((s) => s.split(" ")[0] + " " + (s.split(" ")[1] ?? "")).slice(0, 5);
console.log(`  sample: ${otherSample.join(" | ")}`);

// ── emit ─────────────────────────────────────────────────────────────────────
const guardConstraint = (st) => {
  const m = /^ALTER TABLE ONLY "public"\."(\w+)" ADD CONSTRAINT "(\w+)"[\s\S]*$/exec(st.replace(/\s+/g, " ").trim());
  const body = st.trim().replace(/\s+/g, " ");
  return `do $$ begin\n  if not exists (select 1 from pg_constraint where conname = '${m[2]}' and conrelid = '${m[1]}'::regclass) then\n    ${body}\n  end if;\nend $$;`;
};
const transformPolicy = (st) => {
  const m = /^CREATE POLICY "(\w+)" ON "public"\."(\w+)"/.exec(st.replace(/\s+/g, " ").trim());
  return `drop policy if exists ${q(m[1])} on ${q("public")}.${q(m[2])};\n${st.trim()}`;
};
const transformIndex = (st) => st.replace(/^CREATE (UNIQUE )?INDEX /, (s, u) => `CREATE ${u ?? ""}INDEX IF NOT EXISTS `);
const transformSequence = (st) => st.replace(/^CREATE SEQUENCE /, "CREATE SEQUENCE IF NOT EXISTS ");
const transformView = (st) => st.replace(/^CREATE VIEW /, "CREATE OR REPLACE VIEW ");

const parts = [];
const section = (title, note, arr, tf = (x) => x) => {
  if (!arr.length) return;
  parts.push(`-- ── ${title} ${"─".repeat(Math.max(4, 74 - title.length))}`);
  if (note) parts.push(`-- ${note}`);
  for (const st of arr) parts.push(tf(st.trim()) + (st.trim().endsWith(";") ? "" : ";"));
  parts.push("");
};

const header = `-- Recover out-of-band production objects onto fresh installs (fresh ≡ prod).
--
-- GENERATED by scripts/sql-build-recovery-migration.mjs from
-- docs/sql/backup/prod-schema-2026-11-24.sql (production schema dump,
-- 2026-11-24). Regenerate instead of hand-editing.
--
-- Scope: every public-schema object that exists in production but is created by
-- no file in supabase/migrations/ — i.e. work done out-of-band on production:
--   * customer notifications (2 tables)
--   * family-member request workflow (1 table)
--   * PALRE lens-compatibility / recommendation engine (9 tables + 1 view)
--   * portal read policies on catalogue tables
--   * legacy numbering sequences
-- plus their columns, constraints, indexes, triggers, RLS policies, functions,
-- grants and sequences.
--
-- EXCLUDED on purpose (see docs/sql/OPEN_ISSUES.md):
--   * stock_transfers, stock_transfer_lines, user_branches and every object
--     created by supabase/migrations/disabled/ — the quarantined multi_branch
--     model (disabled/README.md: "Do not move them back ... or apply them to
--     any environment"). These remain production-only until a cleanup decision.
--   * family_members production-only columns/policies/triggers (dual model,
--     0 rows in prod) — pending a model decision.
--
-- Repeat-safe: safe to run against a fresh install, against production (where
-- every object already exists), and twice in a row.
`;

section("tables + RLS", "13 out-of-band feature tables (CREATE TABLE IF NOT EXISTS + row level security)", [...kept.table, ...kept.rls]);
section("columns added to existing tables", null, kept.column);
section("constraints", "FK / PK / checks not carried inside CREATE TABLE — existence-guarded", kept.constraint, guardConstraint);
section("indexes", null, kept.index, transformIndex);
section("sequences", null, kept.sequence, transformSequence);
section("views", null, kept.view, transformView);
section("functions", "CREATE OR REPLACE — idempotent", kept.function);
section("triggers", "CREATE OR REPLACE TRIGGER — idempotent", kept.trigger);
section("policies", "DROP POLICY IF EXISTS + CREATE — idempotent", kept.policy, transformPolicy);
section("grants", "GRANT/REVOKE are idempotent", kept.grant);

const sql = header + parts.join("\n") + `\n-- end of migration\n`;
await writeFile(OUT, sql, "utf8");
const counts = Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, v.length]));
console.log("kept:", JSON.stringify(counts));
console.log(`-> ${OUT} (${sql.length} bytes)`);
