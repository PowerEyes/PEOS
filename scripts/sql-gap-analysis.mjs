// Categorises every schema difference between the fresh install (files replayed)
// and production, using the snapshot diff as the source of truth.
//
//   node scripts/sql-gap-analysis.mjs
//
// Categories
//   LOST_ON_FRESH   public-schema objects that exist in production but a fresh
//                   install does not get (quarantined migration / objects with no
//                   source file / superseded definitions)
//   PENDING_UPGRADE objects a fresh install has but production does not yet
//                   (the not-yet-applied migrations)
//   DEFINITION_DIFF public objects whose definitions differ between the two
//   PLATFORM        auth/storage/realtime/... differences — owned by Supabase,
//                   reported only as a count
//
// Writes docs/sql/gaps.json and prints a summary.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const J = (p) => readFile(join(ROOT, p), "utf8").then(JSON.parse);

const fresh = await J("docs/sql/snapshots/fresh.json");
const prod = await J("docs/sql/snapshots/prod.json");
const drift = await J("docs/sql/drift.json");
const inv = await J("docs/sql/inventory.json");

const PLATFORM = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast)\b/;
const isPlatform = (key) => PLATFORM.test(key.split(".")[0]) || key.startsWith("auth.");

// ── attribution: which file mentions an object name? ────────────────────────
const filesByText = inv.files.map((f) => ({ file: f.file, dir: f.dir }));
let fileTextCache = null;
async function mentions(objName) {
  if (!fileTextCache) {
    const { readdir, readFile: rf } = await import("node:fs/promises");
    fileTextCache = [];
    const walk = async (dir) => {
      let ents = [];
      try { ents = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.name.endsWith(".sql")) fileTextCache.push({ path: p, text: (await rf(p, "utf8")).toLowerCase() });
      }
    };
    await walk(join(ROOT, "supabase"));
  }
  const needle = objName.toLowerCase().split(".").pop();
  return fileTextCache
    .filter((f) => f.text.includes(needle))
    .map((f) => f.path.replace(/\\/g, "/").replace(`${ROOT.replace(/\\/g, "/")}/`, ""))
    .slice(0, 4);
}

const keyCols = (snap) => new Map(snap.columns.map((c) => [`${c.table}.${c.name}`, c]));
const fkCols = keyCols(fresh), pkCols = keyCols(prod);
const setOf = (rows, k) => new Map(rows.map((r) => [k(r), r]));
const fk = {
  table: setOf(fresh.tables, (r) => r.name),
  index: setOf(fresh.indexes, (r) => r.name),
  trigger: setOf(fresh.triggers, (r) => `${r.table}.${r.name}`),
  policy: setOf(fresh.policies, (r) => `${r.table}.${r.name}`),
  function: setOf(fresh.functions, (r) => `${r.name}(${r.args})`),
  view: setOf(fresh.views, (r) => r.name),
  grant: setOf(fresh.grants, (r) => `${r.table}->${r.grantee}`),
  sequence: setOf(fresh.sequences, (r) => r),
  constraint: setOf(fresh.constraints, (r) => `${r.table}#${r.name}`),
};
const pk = {
  table: setOf(prod.tables, (r) => r.name),
  index: setOf(prod.indexes, (r) => r.name),
  trigger: setOf(prod.triggers, (r) => `${r.table}.${r.name}`),
  policy: setOf(prod.policies, (r) => `${r.table}.${r.name}`),
  function: setOf(prod.functions, (r) => `${r.name}(${r.args})`),
  view: setOf(prod.views, (r) => r.name),
  grant: setOf(prod.grants, (r) => `${r.table}->${r.grantee}`),
  sequence: setOf(prod.sequences, (r) => r),
  constraint: setOf(prod.constraints, (r) => `${r.table}#${r.name}`),
};

const verdictByFile = new Map(drift.files.map((f) => [f.file, f.verdict]));
const pendingFiles = drift.files.filter((f) => ["PENDING", "PARTIAL"].includes(f.verdict)).map((f) => f.file);

const out = {
  generatedAt: new Date().toISOString(),
  pendingUpgradeFiles: pendingFiles,
  counts: {},
  LOST_ON_FRESH: { tables: [], columns: [], indexes: [], triggers: [], policies: [], functions: [], views: [], grants: [], sequences: [], constraints: [] },
  PENDING_UPGRADE: { tables: [], columns: [], indexes: [], triggers: [], policies: [], functions: [], views: [], grants: [], sequences: [], constraints: [] },
  DEFINITION_DIFF: { columns: [], functions: [], policies: [], constraints: [], indexes: [], tables: [] },
  PLATFORM: { counts: {} },
};

const featureOf = (key) => {
  const t = key.split(".")[0];
  if (t.startsWith("palre_")) return "palre (lens recommendation engine)";
  if (t === "family_member_requests") return "family-member requests";
  if (t.startsWith("customer_notification")) return "customer notifications";
  if (t.startsWith("lens_package_") || t.startsWith("lens_compatibility_")) return "lens package compatibility (PALRE)";
  if (key.includes("portal_")) return "customer portal notifications";
  if (key.includes("branch_scope") || key.includes("enforce_branch_scope") || key === "apply_branch_scope" || key.includes("stock_transfer")) return "multi-branch stock transfers (disabled migration)";
  if (key.includes("audit_log_immutable") || key.includes("approve_stock_transfer")) return "multi-branch stock transfers (disabled migration)";
  return "unattributed";
};

const attrCache = new Map();
async function attribute(kind, key) {
  const ck = `${kind}:${key}`;
  if (attrCache.has(ck)) return attrCache.get(ck);
  const plain = key.split(".").pop().split("(")[0].split("#")[0].split("->")[0];
  const hits = [];
  for (const f of inv.files) {
    for (const o of f.objects) {
      if (o.object && String(o.object).toLowerCase().includes(plain.toLowerCase())) { hits.push(f.file); break; }
    }
    if (hits.length >= 4) break;
  }
  if (!hits.length) {
    // text search (covers dynamic/DO-block definitions)
    const m = await mentions(plain);
    attrCache.set(ck, { declared: [], mentioned: m });
    return attrCache.get(ck);
  }
  attrCache.set(ck, { declared: hits.slice(0, 4), mentioned: [] });
  return attrCache.get(ck);
}

const SING = { tables: "table", indexes: "index", triggers: "trigger", policies: "policy", functions: "function", views: "view", grants: "grant", sequences: "sequence", constraints: "constraint", columns: "columns" };
for (const kind of Object.keys(out.LOST_ON_FRESH)) {
  const A = fk[SING[kind]], B = pk[SING[kind]];
  if (!A || !B) continue;
  for (const [k, row] of B) {
    if (isPlatform(k)) { out.PLATFORM.counts.lost = (out.PLATFORM.counts.lost ?? 0) + 1; continue; }
    if (A.has(k)) continue;
    const a = await attribute(kind, k);
    out.LOST_ON_FRESH[kind].push({ key: k, feature: featureOf(k), source: a.declared.length ? a.declared : (a.mentioned.length ? a.mentioned : ["(no source in repo)"]), row: row });
  }
  for (const [k, row] of A) {
    if (isPlatform(k)) { out.PLATFORM.counts.pending = (out.PLATFORM.counts.pending ?? 0) + 1; continue; }
    if (B.has(k)) continue;
    const a = await attribute(kind, k);
    out.PENDING_UPGRADE[kind].push({ key: k, source: a.declared.length ? a.declared : (a.mentioned.length ? a.mentioned : ["(no source in repo)"]), row: row });
  }
  // definition diffs on keys present in both (public only)
  for (const [k, brow] of B) {
    if (isPlatform(k) || !A.has(k)) continue;
    const arow = A.get(k);
    const norm = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : JSON.stringify(v));
    const sig = (r) => Object.entries(r).filter(([kk]) => kk !== "name" && kk !== "table").map(([kk, vv]) => `${kk}=${norm(vv)}`).sort().join("|");
    if (sig(arow) !== sig(brow)) out.DEFINITION_DIFF[kind]?.push({ key: k, fresh: arow, prod: brow });
  }
}

// column keys: fresh/prod columns are keyed table.name — handle separately (columns key differs)
{
  const A = fkCols, B = pkCols;
  for (const [k, row] of B) {
    if (isPlatform(k)) { out.PLATFORM.counts.lost = (out.PLATFORM.counts.lost ?? 0) + 1; continue; }
    if (A.has(k)) continue;
    const tbl = k.split(".").slice(0, -1).join(".");
    const a = await attribute("column", tbl);
    out.LOST_ON_FRESH.columns.push({ key: k, feature: featureOf(k), source: a.declared.length ? a.declared : (a.mentioned.length ? a.mentioned : ["(no source in repo)"]), row });
  }
  for (const [k, row] of A) {
    if (isPlatform(k)) { out.PLATFORM.counts.pending = (out.PLATFORM.counts.pending ?? 0) + 1; continue; }
    if (B.has(k)) continue;
    const tbl = k.split(".").slice(0, -1).join(".");
    const a = await attribute("column", tbl);
    out.PENDING_UPGRADE.columns.push({ key: k, source: a.declared.length ? a.declared : (a.mentioned.length ? a.mentioned : ["(no source in repo)"]), row });
  }
  for (const [k, brow] of B) {
    if (isPlatform(k) || !A.has(k)) continue;
    const arow = A.get(k);
    const sig = (r) => `${r.type}|nn=${r.not_null}|def=${r.default}|id=${r.identity}|gen=${r.generated}`;
    if (sig(arow) !== sig(brow)) out.DEFINITION_DIFF.columns.push({ key: k, fresh: arow, prod: brow });
  }
}

for (const grp of [out.LOST_ON_FRESH, out.PENDING_UPGRADE, out.DEFINITION_DIFF]) {
  for (const [k, arr] of Object.entries(grp)) if (Array.isArray(arr) && arr.length) (out.counts[k] ??= {}), (out.counts[k][grp === out.LOST_ON_FRESH ? "lost" : grp === out.PENDING_UPGRADE ? "pending" : "differ"] = arr.length);
}

// attribution + "is it fixed by the pending upgrade?" for every definition diff
const pendingSet = new Set(pendingFiles);
for (const [kind, arr] of Object.entries(out.DEFINITION_DIFF)) {
  if (!Array.isArray(arr)) continue;
  for (const e of arr) {
    const plain = e.key.split(".").pop().split("(")[0].split("#")[0].split("->")[0];
    const a = await attribute(kind === "policies" ? "policy" : kind === "functions" ? "function" : kind, e.key);
    e.source = a.declared.length ? a.declared : a.mentioned;
    e.sourceVerdicts = e.source.map((s) => verdictByFile.get(s) ?? "n/a");
    const m = await mentions(plain);
    e.fixedByPendingUpgrade = m.some((p) => pendingSet.has(p));
    e.mentionedBy = m.slice(0, 4);
  }
}

// group LOST_ON_FRESH tables by feature for the summary
const lostByFeature = {};
for (const t of out.LOST_ON_FRESH.tables) (lostByFeature[t.feature] ??= []).push(t.key);

await mkdir(join(ROOT, "docs", "sql"), { recursive: true });
await writeFile(join(ROOT, "docs", "sql", "gaps.json"), JSON.stringify(out, null, 1));

console.log("== PENDING UPGRADE files (apply to production next) ==");
for (const f of pendingFiles) console.log(`   ${f}`);
console.log("\n== LOST ON FRESH INSTALL (in production, a fresh install does not create them) ==");
for (const [k, arr] of Object.entries(out.LOST_ON_FRESH)) {
  if (!arr?.length) continue;
  console.log(`   ${k}: ${arr.length}`);
}
console.log("   tables by feature:", JSON.stringify(Object.fromEntries(Object.entries(lostByFeature).map(([f, t]) => [f, t.length])), null, 0));
for (const [f, t] of Object.entries(lostByFeature)) console.log(`     - ${f}: ${t.join(", ")}`);
console.log("\n== PENDING UPGRADE objects (fresh has, prod lacks) ==");
for (const [k, arr] of Object.entries(out.PENDING_UPGRADE)) if (arr?.length) console.log(`   ${k}: ${arr.length}`);
console.log("\n== DEFINITION DIFFERS ==");
for (const [k, arr] of Object.entries(out.DEFINITION_DIFF)) if (arr?.length) console.log(`   ${k}: ${arr.length}`);
console.log("\nplatform-schema deltas (excluded):", JSON.stringify(out.PLATFORM.counts));
console.log("\nwritten: docs/sql/gaps.json");
