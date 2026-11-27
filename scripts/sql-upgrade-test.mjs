// Upgrade-path test: restore the production schema dump into a scratch database
// (docs/sql/backup/restore-shim.sql + prod-schema-restore.sql) and then apply
// exactly the migrations that production has NOT recorded as applied — the set
// `supabase db push` would send — verifying repeat-safety of every file.
//
// usage:
//   node scripts/sql-upgrade-test.mjs --restore   # shim + schema restore into scratch (once)
//   node scripts/sql-upgrade-test.mjs --apply     # apply the 28 unrecorded migrations
//   node scripts/sql-upgrade-test.mjs --all       # both
//
// scratch DB: set SCRATCH_DATABASE_URL (qa_restore container)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import pg from "pg";

if (!process.env.SCRATCH_DATABASE_URL) throw new Error("SCRATCH_DATABASE_URL is required");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRATCH = process.env.SCRATCH_DATABASE_URL;
const RESTORE_LOG = join(ROOT, "docs", "sql", "restore-log.txt");
const APPLY_LOG = join(ROOT, "docs", "sql", "upgrade-apply-results.json");

const mode = process.argv[2] ?? "--all";

// ── 1. restore ──────────────────────────────────────────────────────────────
if (mode === "--restore" || mode === "--all") {
  const dump = await readFile(join(ROOT, "docs/sql/backup/prod-schema-2026-11-24.sql"), "utf8");
  // supabase_vault does not exist in vanilla postgres; strip that one statement
  const cleaned = dump.replace(/CREATE EXTENSION IF NOT EXISTS "supabase_vault"[^;]*;/g, "-- supabase_vault extension is Supabase-platform-only; stripped for scratch restore");
  const out = join(ROOT, "docs", "sql", "backup", "prod-schema-restore.sql");
  await writeFile(out, cleaned);
  console.log(`prepared restore script: ${relative(ROOT, out)} (${cleaned.length} bytes)`);

  const docker = (args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  // reset the scratch database first — otherwise --restore only overlays the
  // dump on top of whatever a previous run left behind (observed: objects
  // created by earlier --apply runs made the next --apply fail spuriously)
  docker(["exec", "qa_restore", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q",
    "-c", "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists extensions cascade; drop schema if exists supabase_migrations cascade; create schema public;"]);
  docker(["cp", join(ROOT, "docs/sql/backup/restore-shim.sql"), "qa_restore:/tmp/shim.sql"]);
  docker(["cp", out, "qa_restore:/tmp/schema.sql"]);
  try {
    const shimOut = docker(["exec", "qa_restore", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", "/tmp/shim.sql"]);
    console.log("shim applied OK");
  } catch (e) {
    console.error("SHIM FAILED:\n" + (e.stdout ?? "") + (e.stderr ?? ""));
    process.exit(1);
  }
  let restoreOut = "";
  let restoreErr = "";
  // spawnSync (not execFileSync) so STDERR is captured too — execFileSync
  // returns stdout only, which silently swallowed every psql ERROR line and
  // made overlay restores look clean when they were not
  const r = spawnSync("docker", ["exec", "qa_restore", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=0", "-q", "-f", "/tmp/schema.sql"], { encoding: "utf8" });
  restoreOut = r.stdout ?? "";
  restoreErr = r.stderr ?? "";
  const log = restoreOut + restoreErr;
  await writeFile(RESTORE_LOG, log);
  const errors = log.split("\n").filter((l) => l.includes("ERROR"));
  console.log(`restore finished: ${errors.length} ERROR line(s) -> ${relative(ROOT, RESTORE_LOG).replace(/\\/g, "/")}`);
  for (const e of errors.slice(0, 20)) console.log("   " + e.trim());
  if (errors.length > 20) console.log(`   ... +${errors.length - 20} more`);
}

// ── 2. apply unrecorded migrations ──────────────────────────────────────────
if (mode === "--apply" || mode === "--all") {
  const db = new pg.Client({ connectionString: SCRATCH });
  await db.connect();

  // the production ledger (what has been recorded as applied)
  const prodLedgerRows = JSON.parse(await readFile(join(ROOT, "docs/sql", "inventory-ledger.json"), "utf8").catch(() => "[]"));
  const inv = JSON.parse(await readFile(join(ROOT, "docs/sql/inventory.json"), "utf8"));
  const appliedVersions = new Set(inv.files.filter((f) => f.applied && f.dir === "migrations").map((f) => f.version));

  const entries = (await readdir(join(ROOT, "supabase/migrations"))).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const todo = entries.filter((f) => !appliedVersions.has(f.slice(0, f.indexOf("_"))));
  console.log(`applying ${todo.length} migrations not recorded in the production ledger...`);

  const results = [];
  for (const file of todo) {
    const text = await readFile(join(ROOT, "supabase/migrations", file), "utf8");
    const t0 = Date.now();
    try {
      await db.query(text);           // one implicit transaction per file -> atomic
      results.push({ file, ok: true, ms: Date.now() - t0 });
      console.log(`  OK    ${file} (${Date.now() - t0} ms)`);
    } catch (e) {
      results.push({ file, ok: false, ms: Date.now() - t0, error: e.message, position: e.position ?? null });
      console.log(`  FAIL  ${file}\n        ${e.message}`);
    }
  }
  await writeFile(APPLY_LOG, JSON.stringify({ appliedAt: new Date().toISOString(), scratch: SCRATCH, results }, null, 1));
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} succeeded -> ${relative(ROOT, APPLY_LOG).replace(/\\/g, "/")}`);
  await db.end();
}
