// Export pg_get_functiondef for named functions from a DSN to files:
//   node scripts/sql-export-fn.mjs <dsn> <out-prefix> <fn1> [fn2 ...]
import { writeFile } from "node:fs/promises";
import pg from "pg";

const [dsn, out, ...fns] = process.argv.slice(2);
const db = new pg.Client({ connectionString: dsn });
await db.connect();
for (const fn of fns) {
  const r = await db.query(
    `select pg_get_functiondef(p.oid) as d from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = $1 and p.prokind = 'f'`, [fn]);
  await writeFile(`${out}_${fn}.sql`, r.rows[0]?.d ?? `-- ${fn} absent\n`);
  console.log(`${out}_${fn}.sql: ${r.rows[0] ? r.rows[0].d.length + " bytes" : "ABSENT"}`);
}
await db.end();
