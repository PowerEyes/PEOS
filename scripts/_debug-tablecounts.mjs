// Compare table counts across snapshots and live databases.
import { readFileSync } from "node:fs";
import pg from "pg";

for (const f of ["prod", "fresh", "fresh2", "upgrade", "upgrade2"]) {
  try {
    const s = JSON.parse(readFileSync(`docs/sql/snapshots/${f}.json`, "utf8"));
    console.log(`${f}: tables=${s.tables.length} columns=${s.columns.length} policies=${s.policies.length} functions=${s.functions.length}`);
  } catch (e) { console.log(`${f}: (${e.code})`); }
}

for (const [label, url] of [
  ["local 54522", "postgresql://postgres:postgres@127.0.0.1:54522/postgres"],
  ["scratch 5433", "postgresql://postgres:postgres@127.0.0.1:5433/postgres"],
]) {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const { rows } = await db.query(`select count(*) as n from pg_class c join pg_namespace n2 on n2.oid=c.relnamespace
    where c.relkind='r' and n2.nspname='public' and c.relname not like 'pg_%'`);
  const { rows: r2 } = await db.query(`select count(*) as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
  console.log(`${label}: pg_class relkind=r = ${rows[0].n}, information_schema base tables = ${r2[0].n}`);
  await db.end();
}
