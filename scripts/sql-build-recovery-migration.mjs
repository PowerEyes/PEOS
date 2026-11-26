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
//   * file-table grants production holds but the files revoke (platform_admins,
//     rate_limits -> anon/authenticated): those are hardening gaps fixed by
//     20261217000000_fix_schema_drift.sql, not features to re-create.
//
// usage: node scripts/sql-build-recovery-migration.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DUMP = join(ROOT, "docs/sql/backup/prod-schema-2026-11-24.sql");
const OUT = join(ROOT, "supabase/migrations/20261218000000_recover_out_of_band_features.sql");
const TRIO = new Set(["stock_transfers", "stock_transfer_lines", "user_branches"]);
const SKIP_TABLES = new Set([...TRIO, "family_members"]);

// same platform filter as sql-schema-diff.mjs --public
const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
const flt = (rows) =>
  rows.filter((r) => {
    const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? "");
    return !PLATFORM_RE.test(t);
  });

// key formats replicated from sql-schema-diff.mjs
const KEY = {
  tables: (r) => r.name,
  columns: (r) => `${r.table}.${r.name}`,
  constraints: (r) => `${r.table}#${r.name}`,
  indexes: (r) => r.name,
  triggers: (r) => `${r.table}.${r.name}`,
  functions: (r) => `${r.name}(${r.args})`,
  views: (r) => r.name,
  policies: (r) => `${r.table}.${r.name}`,
  grants: (r) => `${r.table}->${r.grantee}`,
  sequences: (r) => r,
};

const upg = JSON.parse(await readFile(join(ROOT, "docs/sql/snapshots/upgrade.json"), "utf8"));
const fresh = JSON.parse(await readFile(join(ROOT, "docs/sql/snapshots/fresh.json"), "utf8"));

const extraSet = (type) => {
  const a = new Set(flt(upg[type] ?? []).map(KEY[type]));
  const b = new Set(flt(fresh[type] ?? []).map(KEY[type]));
  return [...a].filter((k) => !b.has(k));
};

const extraTables = new Set(extraSet("tables"));
const extraColumns = new Set(extraSet("columns"));
const extraConstraints = new Set(extraSet("constraints"));
const extraIndexes = new Set(extraSet("indexes"));
const extraTriggers = new Set(extraSet("triggers"));
const extraFnNames = new Set(extraSet("functions").map((k) => k.replace(/\(.*$/, "")));
const extraPolicies = new Set(extraSet("policies"));
const extraViews = new Set(extraSet("views"));
const extraSequences = new Set(extraSet("sequences"));

// orphan13 = prod-only tables minus the quarantined trio
const gaps = JSON.parse(await readFile(join(ROOT, "docs/sql/gaps.json"), "utf8"));
const lostTables = (Array.isArray(gaps.LOST_ON_FRESH.tables) ? gaps.LOST_ON_FRESH.tables : Object.values(gaps.LOST_ON_FRESH.tables)).map((t) => t.key ?? t.name);
const orphan13 = new Set(lostTables.filter((n) => !TRIO.has(n)));

// disabled-file identifiers (never re-materialise)
const disabledIds = new Set();
const disDir = join(ROOT, "supabase/migrations/disabled");
for (const f of await readdir(disDir)) {
  if (!f.endsWith(".sql")) continue;
  const t = await readFile(join(disDir, f), "utf8");
  for (const re of [
    /create table (?:if not exists )?(?:public\.)?"?(\w+)"?/gi,
    /create or replace function (?:public\.)?"?(\w+)"?/gi,
    /create trigger "?(\w+)"?/gi,
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
    if (c === "'") { let j = i + 1; while (j < sql.length) { if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; } j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === "$") { const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i)); if (m) { const tag = m[0]; const j = sql.indexOf(tag, i + tag.length); const end = j < 0 ? sql.length - 1 : j + tag.length - 1; cur += sql.slice(i, end + 1); i = end + 1; continue; } }
    if (c === ";") { out.push(cur); cur = ""; i++; continue; }
    cur += c; i++;
  }
  out.push(cur);
  return out;
}
const stripComments = (s) => { let t = s; while (/^\s*--/.test(t)) t = t.replace(/^\s*--[^\n]*\n?/, ""); return t.trim(); };

const stmts = splitStatements(await readFile(DUMP, "utf8")).map(stripComments).filter(Boolean);
console.log(`dump statements: ${stmts.length}`);
console.log(`orphan13 (${orphan13.size}): ${[...orphan13].join(", ")}`);
console.log(`disabled ids: ${disabledIds.size}; extra fns: ${extraFnNames.size}, policies: ${extraPolicies.size}, triggers: ${extraTriggers.size}, grants-objs checked per statement`);

// objects recovery may attach grants to
const grantScope = new Set([...orphan13, ...extraFnNames, ...extraViews, ...extraSequences]);

// ── classify + transform ─────────────────────────────────────────────────────
const kept = { table: [], rls: [], column: [], constraint: [], index: [], sequence: [], view: [], function: [], trigger: [], policy: [], grant: [], other: [] };
const skipped = [];

for (const st of stmts) {
  const one = st.replace(/\s+/g, " ").trim();
  let m;
  if ((m = /^CREATE TABLE IF NOT EXISTS "public"\."(\w+)"/.exec(one))) {
    (orphan13.has(m[1]) ? kept.table : skipped).push(st);
  } else if ((m = /^ALTER TABLE (?:ONLY )?"public"\."(\w+)" (ENABLE|FORCE) ROW LEVEL SECURITY/.exec(one))) {
    (orphan13.has(m[1]) ? kept.rls : skipped).push(st);
  } else if ((m = /^ALTER TABLE (?:ONLY )?"public"\."(\w+)" ADD CONSTRAINT "(\w+)"/.exec(one))) {
    const ok = extraConstraints.has(`${m[1]}#${m[2]}`) && !SKIP_TABLES.has(m[1]) && !disabledIds.has(m[2]);
    (ok ? kept.constraint : skipped).push(st);
  } else if ((m = /^CREATE (UNIQUE )?INDEX "(\w+)" ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraIndexes.has(m[2]) && !SKIP_TABLES.has(m[3]) && !disabledIds.has(m[2]);
    (ok ? kept.index : skipped).push(st);
  } else if ((m = /^ALTER SEQUENCE "public"\."(\w+)" OWNED BY/.exec(one))) {
    (extraSequences.has(m[1]) && !disabledIds.has(m[1]) ? kept.sequence : skipped).push(st);
  } else if ((m = /^CREATE (?:IF NOT EXISTS )?"public"\."(\w+)" OWNED BY/.exec(one))) {
    (extraSequences.has(m[1]) ? kept.sequence : skipped).push(st);
  } else if ((m = /^CREATE SEQUENCE (?:IF NOT EXISTS )?"public"\."(\w+)"/.exec(one))) {
    (extraSequences.has(m[1]) && !disabledIds.has(m[1]) ? kept.sequence : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?VIEW "public"\."(\w+)"/.exec(one))) {
    (extraViews.has(m[2]) ? kept.view : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?FUNCTION "public"\."(\w+)"/.exec(one))) {
    (extraFnNames.has(m[2]) && !disabledIds.has(m[2]) ? kept.function : skipped).push(st);
  } else if ((m = /^CREATE (OR REPLACE )?TRIGGER "(\w+)" (?:BEFORE|AFTER|INSTEAD OF) .*? ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraTriggers.has(`${m[3]}.${m[2]}`) && !SKIP_TABLES.has(m[3]) && !disabledIds.has(m[2]);
    (ok ? kept.trigger : skipped).push(st);
  } else if ((m = /^CREATE POLICY "(\w+)" ON "public"\."(\w+)"/.exec(one))) {
    const ok = extraPolicies.has(`${m[2]}.${m[1]}`) && !SKIP_TABLES.has(m[2]) && !disabledIds.has(m[1]);
    (ok ? kept.policy : skipped).push(st);
  } else if ((m = /^(GRANT|REVOKE) .+ ON (?:TABLE |FUNCTION |SEQUENCE )?"public"\."(\w+)" (?:TO|FROM) /.exec(one))) {
    const ok = grantScope.has(m[2]) && !SKIP_TABLES.has(m[2]) && !disabledIds.has(m[2]);
    (ok ? kept.grant : skipped).push(st);
  } else {
    kept.other.push(one);
  }
}

// file-table extra columns (orphan columns arrive inside CREATE TABLE)
const extraColRows = flt(upg.columns ?? []).filter((r) => {
  const t = r.table.split(".")[0];
  // orphan tables arrive inside CREATE TABLE; view columns arrive with CREATE VIEW
  return extraColumns.has(KEY.columns(r)) && !orphan13.has(t) && !SKIP_TABLES.has(t) && !extraViews.has(t);
});
for (const r of extraColRows) {
  const table = r.table.includes(".") ? r.table.split(".")[1] : r.table;
  let s = `alter table public.${table} add column if not exists ${r.name} ${r.type}`;
  if (r.identity || r.generated) { console.log(`  !! ${table}.${r.name} is identity/generated — review by hand`); }
  if (r.default) s += ` default ${r.default}`;
  if (r.not_null) s += " not null";
  kept.column.push(s + ";");
}
console.log(`file-table extra columns (${extraColRows.length}): ${extraColRows.map((r) => `${r.table}.${r.name}`).join(", ") || "(none)"}`);
console.log(`unclassified statements dropped: ${kept.other.length} — sample: ${[...new Set(kept.other.map((s) => s.split(" ")[0] + " " + (s.split(" ")[1] ?? "")))].slice(0, 8).join(" | ")}`);

// ── transforms ───────────────────────────────────────────────────────────────
const guardConstraint = (st) => {
  const m = /^ALTER TABLE ONLY "public"\."(\w+)" ADD CONSTRAINT "(\w+)"/.exec(st.replace(/\s+/g, " ").trim());
  const body = st.trim().replace(/\s+/g, " ").replace(/;$/, "");
  return `do $$ begin\n  if not exists (select 1 from pg_constraint where conname = '${m[2]}' and conrelid = '${m[1]}'::regclass) then\n    ${body};\n  end if;\nend $$;`;
};
const transformPolicy = (st) => {
  const m = /^CREATE POLICY "(\w+)" ON "public"\."(\w+)"/.exec(st.replace(/\s+/g, " ").trim());
  return `drop policy if exists "${m[1]}" on "public"."${m[2]}";\n${st.trim()}`;
};
const transformIndex = (st) => st.replace(/^CREATE (UNIQUE )?INDEX /, (s, u) => `CREATE ${u ?? ""}INDEX IF NOT EXISTS `);
const transformSequence = (st) => st.replace(/^CREATE SEQUENCE /, "CREATE SEQUENCE IF NOT EXISTS ");
const transformView = (st) => st.replace(/^CREATE VIEW /, "CREATE OR REPLACE VIEW ");
const transformFunction = (st) => st.replace(/^CREATE FUNCTION /, "CREATE OR REPLACE FUNCTION ");
const semicolon = (s) => (s.trim().endsWith(";") ? s.trim() : s.trim() + ";");

// ── emit ─────────────────────────────────────────────────────────────────────
const parts = [];
const section = (title, note, arr, tf = semicolon) => {
  if (!arr.length) return;
  parts.push(`-- ${title} ${"─".repeat(Math.max(4, 76 - title.length))}`);
  if (note) parts.push(`-- ${note}`);
  for (const st of arr) parts.push(tf(st));
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
--   * customer notifications (2 tables + own/read/update policies)
--   * family-member request workflow (1 table, 4 policies, 4 functions)
--   * PALRE lens-compatibility / recommendation engine (9 tables, 1 view,
--     guards + validators, sequences)
--   * portal read policies on catalogue tables (appointments, cart_items,
--     loyalty_ledger, payments, prescriptions, sale_lines, sales)
--   * legacy numbering sequences (customer/prescription/vision/household/
--     eye-examination)
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
--   * platform_admins/rate_limits anon+authenticated grants — hardening gaps
--     fixed by 20261217000000_fix_schema_drift.sql instead.
--
-- Repeat-safe: safe on a fresh install, on production (objects exist there
-- already) and twice in a row.
`;

section("tables + row level security", `${orphan13.size} out-of-band feature tables (CREATE TABLE IF NOT EXISTS + ENABLE ROW LEVEL SECURITY)`, [...kept.table, ...kept.rls]);
section("columns added to existing tables", null, kept.column);
section("constraints", "FK / PK / checks not carried inside CREATE TABLE — existence-guarded", kept.constraint, guardConstraint);
section("indexes", null, kept.index, transformIndex);
section("sequences", null, kept.sequence, transformSequence);
section("views", null, kept.view, transformView);
section("functions", "CREATE OR REPLACE — idempotent", kept.function, transformFunction);
section("triggers", "CREATE OR REPLACE TRIGGER — idempotent", kept.trigger);
section("policies", "DROP POLICY IF EXISTS + CREATE — idempotent", kept.policy, transformPolicy);
section("grants", "GRANT/REVOKE are idempotent", kept.grant);

const sql = header + parts.join("\n") + "\n-- end of migration\n";
await writeFile(OUT, sql, "utf8");
console.log("kept:", JSON.stringify(Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, v.length]))));
console.log(`kept functions: ${kept.function.map((s) => (/CREATE (?:OR REPLACE )?FUNCTION "public"\."(\w+)"/.exec(s)?.[1] ?? "?")).join(", ")}`);
console.log(`skipped: ${skipped.length}`);
console.log(`-> ${OUT} (${sql.length} bytes)`);
