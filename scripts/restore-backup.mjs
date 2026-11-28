#!/usr/bin/env node
// Restore a PowerOS backup (poweros-backup-*.json.gz) into a Postgres database that already has all migrations applied.
//   node scripts/restore-backup.mjs <file.json.gz>                 → dry run: shows what would be inserted
//   DATABASE_URL=postgres://... node scripts/restore-backup.mjs <file.json.gz> --apply
// Existing rows (same primary key) are left untouched; missing rows are inserted. Runs in ONE transaction with
// triggers/foreign keys deferred (session_replication_role=replica) so history, audit and stock are restored as saved.
// Use a staging project first. The organisation row is included in new backups, so a blank project can be restored directly.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error("Usage: restore-backup.mjs <backup.json.gz> [--apply]"); process.exit(2); }
const doc = JSON.parse(gunzipSync(readFileSync(file)).toString());
if (doc.format !== "poweros-backup/1" || typeof doc.tables !== "object") { console.error("Not a PowerOS backup file."); process.exit(2); }
const ident = (t) => { if (!/^[a-z_][a-z0-9_]*$/.test(t)) throw new Error(`Unsafe table name: ${t}`); return t; };
const tables = Object.entries(doc.tables).filter(([, rows]) => rows.length);
console.log(`Backup of org ${doc.org_id} taken ${doc.created_at}`);
for (const [t, rows] of tables) console.log(`  ${t.padEnd(40)} ${rows.length}`);
if (!flags.includes("--apply")) { console.log("\nDry run only. Re-run with --apply and DATABASE_URL to restore."); process.exit(0); }
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL to apply."); process.exit(2); }

const psql = (args, input) => spawnSync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q", ...args], { input, encoding: "utf8", maxBuffer: 1 << 30 });
// Generated columns cannot be inserted; they are recomputed by the database.
const gen = new Set(psql(["-At", "-c", "select table_name||'.'||column_name from information_schema.columns where table_schema='public' and (is_generated='ALWAYS' or identity_generation='ALWAYS')"]).stdout.split("\n").filter(Boolean));
let sql = "set local session_replication_role = replica;\n";
const all = doc.organization ? [["organizations", [doc.organization]], ...tables] : tables;
for (const [t, rows] of all) {
  const cols = Object.keys(rows[0]).filter((c) => !gen.has(`${t}.${c}`) && /^[a-z_][a-z0-9_]*$/.test(c)).map((c) => `"${c}"`).join(", ");
  const tag = "$j" + randomBytes(6).toString("hex") + "$";
  sql += `insert into public.${ident(t)} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${ident(t)}, ${tag}${JSON.stringify(rows)}${tag}::jsonb) on conflict do nothing;\n`;
}
const r = psql(["-1"], sql);
if (r.status !== 0) { console.error(r.stderr); console.error("Restore failed; nothing was changed."); process.exit(1); }
console.log("Restore complete.");
