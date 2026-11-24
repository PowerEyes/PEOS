// Seed test: apply supabase/seed/*.sql twice against the fresh local database
// to verify (a) seeds run cleanly on a freshly migrated DB and (b) which seed
// files are repeat-safe. Writes docs/sql/seed-test-results.json.
//
//   node scripts/sql-seed-test.mjs

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCAL = process.env.SEED_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54522/postgres";
const SEED_DIR = join(ROOT, "supabase", "seed");
const OUT = join(ROOT, "docs", "sql", "seed-test-results.json");

const COUNT_TABLES = ["organizations", "branches", "brands", "lens_packages", "lens_options", "org_settings", "products"];

const db = new pg.Client({ connectionString: LOCAL });
await db.connect();

const files = (await readdir(SEED_DIR)).filter((f) => f.endsWith(".sql")).sort((a, b) => {
  // seed.sql (org+branches) first, then dependency order
  const rank = (n) => (n === "seed.sql" ? 0 : n === "seed_branches.sql" ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
});

const counts = async () => {
  const out = {};
  for (const t of COUNT_TABLES) {
    try {
      out[t] = Number((await db.query(`select count(*)::int as n from ${t}`)).rows[0].n);
    } catch { out[t] = null; } // table may not exist on a fresh DB
  }
  return out;
};

const report = { ranAt: new Date().toISOString(), database: LOCAL, passes: [], countsAfterFirstPass: null, countsAfterSecondPass: null };

for (const pass of [1, 2]) {
  const results = [];
  for (const file of files) {
    const text = await readFile(join(SEED_DIR, file), "utf8");
    const t0 = Date.now();
    try {
      await db.query(text);
      results.push({ file, ok: true, ms: Date.now() - t0 });
      console.log(`  pass${pass} OK    ${file} (${Date.now() - t0} ms)`);
    } catch (e) {
      results.push({ file, ok: false, ms: Date.now() - t0, error: e.message });
      console.log(`  pass${pass} FAIL  ${file}\n         ${e.message}`);
    }
  }
  report.passes.push({ pass, results });
  if (pass === 1) report.countsAfterFirstPass = await counts();
  else report.countsAfterSecondPass = await counts();
}

report.repeatSafe = report.passes[1].results.every((r) => r.ok);
report.countStable = JSON.stringify(report.countsAfterFirstPass) === JSON.stringify(report.countsAfterSecondPass);

await import("node:fs/promises").then((fs) => fs.writeFile(OUT, JSON.stringify(report, null, 1)));
console.log(`\nrepeat-safe: ${report.repeatSafe}   counts stable across passes: ${report.countStable}`);
console.log(`-> ${OUT.replace(/\\/g, "/")}`);
await db.end();
