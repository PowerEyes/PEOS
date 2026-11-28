// Run fix + recovery in ONE transaction on the live fresh DB, then roll back —
// proves the ordered pair works together (recovery's functions see the columns
// the fix migration adds).
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const files = [
  "supabase/migrations/20261217000000_fix_schema_drift.sql",
  "supabase/migrations/20261218000000_recover_out_of_band_features.sql",
];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  for (const f of files) {
    const text = await readFile(f, "utf8");
    await db.query(text);
    console.log(`OK    ${f}`);
  }
  // spot-check the converged state before rollback
  const { rows } = await db.query(`
    select
      (select count(*) from information_schema.columns
        where table_schema='public' and table_name='family_members'
          and column_name in ('customer_id','name') and is_nullable='NO') as fm_notnull,
      (select count(*) from information_schema.columns
        where table_schema='public' and table_name='role_permissions'
          and column_name='id') as rp_id,
      (select count(*) from pg_policies
        where schemaname='public' and policyname in ('fm_customer','fm_staff')) as fm_policies,
      (select count(*) from pg_constraint
        where conname='role_permissions_permission_fkey') as rp_fk,
      (select count(*) from pg_constraint
        where conname='family_members_org_id_fkey'
          and confdeltype='c') as fm_org_cascade
  `);
  console.log("converged spot-check:", JSON.stringify(rows[0]));
  await db.query("ROLLBACK");
  console.log("COMBINED OK (rolled back)");
} catch (e) {
  console.log(`FAIL: ${e.message}`);
  try { await db.query("ROLLBACK"); } catch { /* ignore */ }
  process.exitCode = 1;
}
await db.end();
