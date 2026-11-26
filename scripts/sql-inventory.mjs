// SQL inventory + dependency mapper for the PowerOS repository.
//
//   node scripts/sql-inventory.mjs            -> prints summary, writes docs/sql/inventory.json
//   node scripts/sql-inventory.mjs --quiet    -> only writes the JSON
//
// What it does
//   1. Reads every .sql file under supabase/ (migrations, migrations/disabled, seed, tests).
//   2. Splits each file into statements, correctly handling dollar-quoting, strings and comments.
//   3. Classifies statements (table/index/function/trigger/policy/view/type/dml/grant/drop...).
//   4. Builds a global object -> definition map (duplicate + conflict detection).
//   5. Builds a file-level dependency graph (a file "reads" objects other files "write").
//   6. Compares file versions against supabase_migrations.schema_migrations (the applied ledger).
//
// It never modifies anything.

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "docs", "sql", "inventory.json");
const QUIET = process.argv.includes("--quiet");

const log = (...a) => { if (!QUIET) console.log(...a); };

// ────────────────────────────────────────────────────────────────────────────
// 1. Statement splitting
// ────────────────────────────────────────────────────────────────────────────

/** Splits SQL text into statements, respecting 'strings', $$dollar$$ quotes,
 *  -- line comments and /* block comments *\/ . Returns [{sql, line}] */
function splitStatements(text) {
  const out = [];
  let buf = "";
  let line = 1;
  let startLine = 1;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "\n") line++;
    // line comment
    if (c === "-" && text[i + 1] === "-") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) { if (text[i] === "\n") line++; i++; }
      i += 2;
      continue;
    }
    // single quoted string ('' escapes)
    if (c === "'") {
      buf += c; i++;
      while (i < n) {
        if (text[i] === "\n") line++;
        if (text[i] === "'") {
          if (text[i + 1] === "'") { buf += "''"; i += 2; continue; }
          buf += "'"; i++; break;
        }
        buf += text[i]; i++;
      }
      continue;
    }
    // dollar quote $tag$ ... $tag$
    if (c === "$") {
      const m = /^\$[A-Za-z_0-9]*\$/.exec(text.slice(i, i + 64));
      if (m) {
        const tag = m[0];
        buf += tag; i += tag.length;
        const close = text.indexOf(tag, i);
        if (close === -1) { buf += text.slice(i); i = n; continue; }
        const inner = text.slice(i, close);
        line += (inner.match(/\n/g) || []).length;
        buf += inner + tag;
        i = close + tag.length;
        continue;
      }
    }
    if (c === ";") {
      const sql = buf.trim();
      if (sql) out.push({ sql, line: startLine });
      buf = "";
      startLine = line + 1;
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push({ sql: tail, line: startLine });
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Classification
// ────────────────────────────────────────────────────────────────────────────

const norm = (s) => s.replace(/\s+/g, " ").trim();
const unqual = (name) => name.replace(/^public\./i, "");

/** Extracts the column names declared in a `create table (...)` statement. */
function columnsOf(sql) {
  const open = sql.indexOf("(");
  if (open === -1) return [];
  // walk to the matching close paren, skipping quoted strings
  let depth = 0, i = open, inStr = false;
  for (; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) { if (c === "'") { if (sql[i + 1] === "'") { i++; continue; } inStr = false; } continue; }
    if (c === "'") { inStr = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) break; }
  }
  const body = sql.slice(open + 1, i);
  const out = [];
  let buf = "", d = 0;
  const parts = [];
  for (const ch of body) {
    if (ch === "(") d++;
    if (ch === ")") d--;
    if (ch === "," && d === 0) { parts.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  for (const p of parts) {
    const t = p.trim();
    if (/^(constraint|primary|unique|check|foreign|exclude|like)\b/i.test(t)) continue;
    const cm = /^"?([A-Za-z_][A-Za-z0-9_]*)"?\s/.exec(t);
    if (cm) out.push(cm[1].toLowerCase());
  }
  return out;
}

function classify(sql) {
  const s = norm(sql);
  const low = s.toLowerCase();

  let m;
  if ((m = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "table", object: unqual(m[1]), action: "create", columns: columnsOf(sql) };
  if ((m = /^create\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "table", object: unqual(m[1]), action: "create", columns: columnsOf(sql) };

  if ((m = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([^\s]+)/i.exec(s))) {
    const table = unqual(m[1]);
    const rest = s.slice(m[0].length).trimStart();   // trimStart: branches are ^-anchored
    if ((m = /^add\s+column\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i.exec(rest)))
      return { kind: "column", object: `${table}.${unqual(m[1])}`, action: "add", parent: table };
    if (/^drop\s+column\s+(?:if\s+exists\s+)?([^\s]+)/i.exec(rest))
      return { kind: "column", object: table, action: "drop" };
    if ((m = /^add\s+(?:constraint\s+([^\s]+)\s+)?/i.exec(rest)))
      return { kind: "constraint", object: table, action: "add", parent: table, detail: rest.slice(0, 90) };
    if (/^drop\s+constraint/i.test(rest)) return { kind: "constraint", object: table, action: "drop", parent: table };
    if (/^enable\s+row\s+level\s+security/i.test(rest)) return { kind: "rls", object: table, action: "enable" };
    if (/^disable\s+row\s+level\s+security/i.test(rest)) return { kind: "rls", object: table, action: "disable" };
    if (/^force\s+row\s+level\s+security/i.test(rest)) return { kind: "rls", object: table, action: "force" };
    if ((m = /^alter\s+column\s+([^\s]+)/i.exec(rest)))
      return { kind: "column", object: `${table}.${unqual(m[1])}`, action: "alter", parent: table, detail: rest.slice(0, 90) };
    if (/^owner\s+to/i.test(rest)) return { kind: "table", object: table, action: "owner" };
    return { kind: "table", object: table, action: "alter", detail: rest.slice(0, 90) };
  }

  if ((m = /^create\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:concurrently\s+)?index\s+(?:if\s+not\s+exists\s+)?([^\s]+)\s+on\s+([^\s(]+)/i.exec(s)))
    return { kind: "index", object: unqual(m[1]), action: "create", parent: unqual(m[2]) };
  if ((m = /^drop\s+index\s+(?:if\s+exists\s+)?([^\s]+)/i.exec(s)))
    return { kind: "index", object: unqual(m[1]), action: "drop" };

  if ((m = /^create\s+(?:or\s+replace\s+)?function\s+([^\s(]+)/i.exec(s)))
    return { kind: "function", object: unqual(m[1]), action: "create" };
  if ((m = /^drop\s+function\s+(?:if\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "function", object: unqual(m[1]), action: "drop" };

  if ((m = /^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+([^\s]+)\s+(.*)$/i.exec(s))) {
    // the timing clause (before/after/instead of ...) sits between the trigger
    // name and the `on <table>` clause, so find `on` inside the remainder.
    const onm = /\bon\s+([^\s(]+)/i.exec(m[2]);
    if (onm) {
      const tbl = unqual(onm[1]);
      return { kind: "trigger", object: `${tbl}.${unqual(m[1])}`, action: "create", parent: tbl };
    }
  }
  if ((m = /^drop\s+trigger\s+(?:if\s+exists\s+)?([^\s]+)\s+on\s+([^\s]+)/i.exec(s)))
    return { kind: "trigger", object: `${unqual(m[2])}.${unqual(m[1])}`, action: "drop", parent: unqual(m[2]) };

  if ((m = /^create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "view", object: unqual(m[1]), action: "create" };
  if ((m = /^drop\s+view\s+(?:if\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "view", object: unqual(m[1]), action: "drop" };

  if ((m = /^create\s+policy\s+([^\s]+)\s+on\s+([^\s]+)/i.exec(s)))
    return { kind: "policy", object: `${unqual(m[2])}.${unqual(m[1])}`, action: "create", parent: unqual(m[2]) };
  if ((m = /^drop\s+policy\s+(?:if\s+exists\s+)?([^\s]+)\s+on\s+([^\s]+)/i.exec(s)))
    return { kind: "policy", object: `${unqual(m[2])}.${unqual(m[1])}`, action: "drop", parent: unqual(m[2]) };

  if ((m = /^create\s+(?:or\s+replace\s+)?type\s+([^\s(]+)/i.exec(s)))
    return { kind: "type", object: unqual(m[1]), action: "create" };
  if ((m = /^drop\s+type\s+(?:if\s+exists\s+)?([^\s(]+)/i.exec(s)))
    return { kind: "type", object: unqual(m[1]), action: "drop" };

  if ((m = /^create\s+sequence\s+(?:if\s+not\s+exists\s+)?([^\s]+)/i.exec(s)))
    return { kind: "sequence", object: unqual(m[1]), action: "create" };

  if (/^create\s+extension/i.test(s)) {
    const e = /^create\s+(?:if\s+not\s+exists\s+)?extension\s+"?([^\s"]+)"?/i.exec(s);
    return { kind: "extension", object: e ? e[1] : "?", action: "create" };
  }
  if (/^create\s+schema/i.test(s)) {
    const e = /^create\s+(?:if\s+not\s+exists\s+)?schema\s+"?([^\s"]+)"?/i.exec(s);
    return { kind: "schema", object: e ? e[1] : "?", action: "create" };
  }
  if (/^(grant|revoke)\b/i.test(s)) return { kind: "privilege", object: s.slice(0, 80), action: "grant" };
  if (/^comment\s+on/i.test(s)) return { kind: "comment", object: s.slice(0, 80), action: "comment" };
  if (/^(insert\s+into|update|delete\s+from|merge)\b/i.test(s)) {
    const t = /^(?:insert\s+into|update|delete\s+from|merge\s+into)\s+([^\s(]+)/i.exec(s);
    return { kind: "dml", object: t ? unqual(t[1]) : "?", action: low.startsWith("insert") ? "insert" : low.startsWith("update") ? "update" : "delete" };
  }
  if (/^drop\s+table\s+(?:if\s+exists\s+)?([^\s(]+)/i.test(s)) {
    const t = /^drop\s+table\s+(?:if\s+exists\s+)?([^\s(]+)/i.exec(s);
    return { kind: "table", object: unqual(t[1]), action: "drop" };
  }
  if (/^do\s+\$\$/i.test(s) || /^do\s+'/i.test(s)) return { kind: "do", object: "(anonymous block)", action: "do" };
  if (/^(set|reset|select\s+pg_catalog|select\s+public\.|with)\b/i.test(s)) return { kind: "utility", object: s.slice(0, 60), action: "utility" };
  return { kind: "other", object: s.slice(0, 70), action: "other" };
}

/** Objects referenced (read) by a statement — used for the dependency graph. */
function referencedTables(sql) {
  const refs = new Set();
  const re = /\b(?:from|join|into|update|table|on policy|references)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi;
  let m;
  while ((m = re.exec(sql))) {
    const name = unqual(m[1].toLowerCase());
    if (["only", "select", "lateral", "pg_catalog", "public", "auth", "information_schema"].includes(name)) continue;
    refs.add(name);
  }
  return [...refs];
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Walk files
// ────────────────────────────────────────────────────────────────────────────

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".sql")) out.push(p);
  }
  return out;
}

const versionOf = (file) => {
  const base = file.split(/[\\/]/).pop();
  const m = /^(\d+)_(.+)\.sql$/.exec(base);
  return m ? { version: m[1], name: m[2] } : { version: null, name: base.replace(/\.sql$/, "") };
};

const files = [
  ...(await walk(join(ROOT, "supabase", "migrations"))),
  ...(await walk(join(ROOT, "supabase", "seed"))),
  ...(await walk(join(ROOT, "supabase", "tests"))),
].sort();

// ────────────────────────────────────────────────────────────────────────────
// 4. Applied ledger
// ────────────────────────────────────────────────────────────────────────────

async function ledger() {
  const dsn = process.env.DATABASE_URL ??
    "postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
  const client = new pg.Client({ connectionString: dsn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const r = await client.query("select version, name from supabase_migrations.schema_migrations order by version");
    return r.rows;
  } catch (e) {
    log(`! could not read migration ledger: ${e.message}`);
    return null;
  } finally { await client.end(); }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Build
// ────────────────────────────────────────────────────────────────────────────

const appliedRows = await ledger();
const applied = new Map((appliedRows ?? []).map((r) => [r.version, r.name]));

const inventory = [];
const objectMap = new Map(); // "kind:object" -> [{file, action, line}]
const perFileDeps = [];

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const text = await readFile(abs, "utf8");
  const sha = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const { version, name } = versionOf(abs);
  const dir = rel.includes("/disabled/") ? "disabled" : rel.startsWith("supabase/migrations") ? "migrations" : rel.startsWith("supabase/seed") ? "seed" : "tests";

  const stmts = splitStatements(text);
  const objects = [];
  const reads = new Set();
  for (const st of stmts) {
    const c = classify(st.sql);
    objects.push({ ...c, line: st.line });
    const key = `${c.kind}:${c.object.toLowerCase()}`;
    if (!objectMap.has(key)) objectMap.set(key, []);
    objectMap.get(key).push({ file: rel, action: c.action, line: st.line, kind: c.kind });
    for (const t of referencedTables(st.sql)) reads.add(t);
  }

  const rec = {
    file: rel,
    dir,
    version,
    name,
    bytes: text.length,
    sha256_16: sha,
    applied: version != null && applied.has(version),
    appliedName: version != null ? applied.get(version) ?? null : null,
    statements: stmts.length,
    counts: objects.reduce((a, o) => ((a[o.kind] = (a[o.kind] ?? 0) + 1), a), {}),
    objects: objects.filter((o) => !["utility", "comment", "other", "privilege"].includes(o.kind)),
    reads: [...reads].sort(),
  };
  inventory.push(rec);
  perFileDeps.push({ file: rel, reads: rec.reads, writes: [...new Set(objects.filter((o) => !["dml", "do", "utility", "comment", "other", "privilege"].includes(o.kind)).map((o) => `${o.kind}:${o.object.toLowerCase()}`))] });
}

// duplicates: same object created by more than one file (create actions only)
const duplicates = [];
for (const [key, defs] of objectMap) {
  const creates = defs.filter((d) => ["create", "add", "enable"].includes(d.action));
  const uniqFiles = [...new Set(creates.map((d) => d.file))];
  if (uniqFiles.length > 1) duplicates.push({ object: key, files: uniqFiles, count: creates.length });
}

// ledger comparison
const fileVersions = inventory.filter((f) => f.dir === "migrations" && f.version).map((f) => ({ version: f.version, file: f.file, applied: f.applied, appliedName: f.appliedName, name: f.name }));
const ledgerOnly = (appliedRows ?? []).filter((r) => !fileVersions.some((f) => f.version === r.version));
const fileOnly = fileVersions.filter((f) => !f.applied);
const nameMismatch = fileVersions.filter((f) => f.applied && f.appliedName !== f.name);

// file-level dependency edges (A depends on B when A reads something B writes)
const writeIndex = new Map();
for (const d of perFileDeps) for (const w of d.writes) { if (!writeIndex.has(w)) writeIndex.set(w, []); writeIndex.get(w).push(d.file); }
const edges = [];
for (const d of perFileDeps) {
  for (const r of d.reads) {
    const keyCandidates = [`table:${r}`, `view:${r}`, `function:${r}`, `column:${r}`];
    for (const k of keyCandidates) {
      for (const writer of writeIndex.get(k) ?? []) {
        if (writer !== d.file) edges.push({ from: writer, to: d.file, on: r });
      }
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  root: "supabase/",
  totals: {
    files: inventory.length,
    byDir: inventory.reduce((a, f) => ((a[f.dir] = (a[f.dir] ?? 0) + 1), a), {}),
    statements: inventory.reduce((a, f) => a + f.statements, 0),
    bytes: inventory.reduce((a, f) => a + f.bytes, 0),
    uniqueObjects: objectMap.size,
    duplicateObjects: duplicates.length,
  },
  ledger: {
    available: !!appliedRows,
    appliedCount: (appliedRows ?? []).length,
    ledgerOnly,
    fileOnlyNotYetApplied: fileOnly,
    nameMismatches: nameMismatch,
  },
  files: inventory,
  duplicates,
  dependencyEdges: edges,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(result, null, 1));

log(`files: ${result.totals.files}  (${JSON.stringify(result.totals.byDir)})`);
log(`statements: ${result.totals.statements}   bytes: ${result.totals.bytes}`);
log(`unique objects: ${result.totals.uniqueObjects}   objects defined in >1 file: ${duplicates.length}`);
log(`ledger applied: ${result.ledger.appliedCount}`);
log(`-- in ledger but no file: ${ledgerOnly.length}`);
for (const l of ledgerOnly) log(`     ${l.version}_${l.name}`);
log(`-- file exists but not applied: ${fileOnly.length}`);
for (const f of fileOnly) log(`     ${f.file}`);
log(`-- version applied under a different name: ${nameMismatch.length}`);
for (const f of nameMismatch) log(`     ${f.file}  (ledger name: ${f.appliedName})`);
log(`dependency edges (file -> file): ${edges.length}`);
log(`written: ${relative(ROOT, OUT).replace(/\\/g, "/")}`);
