// Coverage check: which production-only (extra) keys does the generated
// recovery migration NOT cover? Expected uncovered: quarantined trio,
// family_members model, disabled/-file objects, file-table hardening grants.
import { readFile } from "node:fs/promises";

const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
const flt = (rows) => rows.filter((r) => { const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? ""); return !PLATFORM_RE.test(t); });
const KEY = {
  tables: (r) => r.name, columns: (r) => `${r.table}.${r.name}`, constraints: (r) => `${r.table}#${r.name}`,
  indexes: (r) => r.name, triggers: (r) => `${r.table}.${r.name}`, functions: (r) => `${r.name}(${r.args})`,
  views: (r) => r.name, policies: (r) => `${r.table}.${r.name}`, grants: (r) => `${r.table}->${r.grantee}`, sequences: (r) => r,
};
const upg = JSON.parse(await readFile("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(await readFile("docs/sql/snapshots/fresh.json", "utf8"));
const sql = await readFile("supabase/migrations/20261218000000_recover_out_of_band_features.sql", "utf8");

const CHECK = {
  tables: (k) => sql.includes(`CREATE TABLE IF NOT EXISTS "public"."${k}"`),
  columns: (k) => {
    const t = k.split(".")[0], c = k.split(".").slice(1).join(".");
    return sql.includes(`add column if not exists ${c} `) || new RegExp(`CREATE TABLE IF NOT EXISTS "public"\\."${t}"[\\s\\S]*?"${c}"`).test(sql);
  },
  constraints: (k) => { const [t, n] = [k.split("#")[0], k.split("#")[1]]; return sql.includes(`ADD CONSTRAINT "${n}"`) || sql.includes(`conname = '${n}'`); },
  indexes: (k) => sql.includes(`INDEX IF NOT EXISTS "${k}"`),
  triggers: (k) => sql.includes(`TRIGGER "${k.split(".")[1]}"`),
  functions: (k) => sql.includes(`FUNCTION "public"."${k.replace(/\(.*$/, "")}"`),
  views: (k) => sql.includes(`VIEW "public"."${k}"`),
  policies: (k) => sql.includes(`POLICY "${k.split(".")[1]}"`),
  grants: (k) => {
    const [obj, role] = [k.split("->")[0], k.split("->")[1]];
    return /ON (TABLE|FUNCTION|SEQUENCE) "public"\."[^"]+" TO "[^"]*"'?/.test(sql)
      && sql.includes(`"${role}"`)
      && (sql.includes(`ON TABLE "public"."${obj}"`) || sql.includes(`ON FUNCTION "public"."${obj}`) || sql.includes(`ON SEQUENCE "public"."${obj}"`));
  },
  sequences: (k) => sql.includes(`SEQUENCE IF NOT EXISTS "public"."${k}"`),
};

for (const type of Object.keys(KEY)) {
  const a = new Set(flt(upg[type] ?? []).map(KEY[type]));
  const b = new Set(flt(fresh[type] ?? []).map(KEY[type]));
  const extra = [...a].filter((k) => !b.has(k));
  if (!extra.length) continue;
  const miss = extra.filter((k) => !CHECK[type](k));
  console.log(`\n== ${type}: ${extra.length} extra — ${extra.length - miss.length} covered, ${miss.length} NOT covered`);
  for (const k of miss) console.log(`   MISS ${k}`);
}
