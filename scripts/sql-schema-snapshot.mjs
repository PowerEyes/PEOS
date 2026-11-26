// Normalised schema snapshot of a Postgres database (structure only, no data).
//
//   node scripts/sql-schema-snapshot.mjs "<url>" docs/sql/snapshots/prod.json
//
// The snapshot is designed for deterministic diffing (scripts/sql-schema-diff.mjs):
// whitespace-normalised definitions, public. prefixes stripped, no data.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error(`usage: node scripts/sql-schema-snapshot.mjs "<url>" <out.json>`);
  process.exit(1);
}

const norm = (s) => (s ?? "").replace(/\s+/g, " ").replace(/s+;$/s, ";").replace(/\bpublic\./g, "").trim();

const db = new pg.Client({ connectionString: url, ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : undefined });
await db.connect();
const q = async (sql) => (await db.query(sql)).rows;

const snap = {};

// extensions
snap.extensions = (await q(`select extname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
  where n.nspname not in ('pg_catalog','information_schema') order by 1`)).map((r) => r.extname);

// enums / composite types
snap.types = (await q(`
  select n.nspname as schema, t.typname as name, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
  from pg_type t join pg_namespace n on n.oid=t.typnamespace
  left join pg_enum e on e.enumtypid=t.oid
  where n.nspname not in ('pg_catalog','information_schema') and t.typtype='e'
  group by 1,2 order by 1,2`)).map((r) => ({ name: r.schema === "public" ? r.name : `${r.schema}.${r.name}`, labels: r.labels }));

// tables + columns
snap.tables = (await q(`
  select n.nspname as schema, c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as forced_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema') and c.relkind in ('r','p')
  order by 1,2`)).map((t) => ({ ...t, name: t.schema === "public" ? t.name : `${t.schema}.${t.name}` }));

snap.columns = (await q(`
  select n.nspname as schema, c.relname as table_name, a.attname as name,
         format_type(a.atttypid, a.atttypmod) as type,
         a.attnotnull as not_null,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '') as default_expr,
         a.attidentity <> '' as identity, a.attgenerated <> '' as generated
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname not in ('pg_catalog','information_schema') and a.attnum > 0 and not a.attisdropped
    and c.relkind in ('r','p','v','m')
  order by 1,2,a.attnum`))
  .map((r) => ({
    table: r.schema === "primary" ? r.table_name : (r.schema === "public" ? r.table_name : `${r.schema}.${r.table_name}`),
    name: r.name, type: r.type,
    not_null: r.not_null, default: norm(r.default_expr), identity: r.identity, generated: r.generated,
  }));

// constraints (pk, unique, check, fk, exclude)
snap.constraints = (await q(`
  select n.nspname as schema, rel.relname as table_name, con.conname as name,
         case con.contype when 'p' then 'primary_key' when 'u' then 'unique' when 'c' then 'check'
                          when 'f' then 'foreign_key' when 'x' then 'exclusion' when 't' then 'trigger' end as type,
         pg_get_constraintdef(con.oid) as def
  from pg_constraint con
  join pg_class rel on rel.oid=con.conrelid
  join pg_namespace n on n.oid=rel.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
  order by 1,2,1`))
  .map((r) => ({
    table: r.schema === "public" ? r.table_name : `${r.schema}.${r.table_name}`,
    name: r.name, type: r.type, def: norm(r.def),
  }));

// indexes (all, incl. constraint-backed — constraint defs live above)
snap.indexes = (await q(`
  select n.nspname as schema, ic.relname as index_name, tc.relname as table_name,
         i.indisprimary as primary, i.indisunique as unique,
         pg_get_indexdef(i.indexrelid) as def
  from pg_index i
  join pg_class ic on ic.oid=i.indexrelid
  join pg_class tc on tc.oid=i.indrelid
  join pg_namespace n on n.oid=ic.relnamespace
  where n.nspname not in ('pg_catalog','information_schema')
  order by 1,2`))
  .map((r) => ({
    name: r.schema === "public" ? r.index_name : `${r.schema}.${r.index_name}`,
    table: r.schema === "public" ? r.table_name : `${r.schema}.${r.table_name}`,
    primary: r.primary, unique: r.unique, def: norm(r.def).replace(/ using btree/g, " using btree"),
  }));

// triggers (statement-level and row-level, incl. constraint triggers)
snap.triggers = (await q(`
  select n.nspname as schema, c.relname as table_name, t.tgname as name, pg_get_triggerdef(t.oid) as def
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema') and not t.tgisinternal
  order by 1,2,3`))
  .map((r) => ({
    table: r.schema === "public" ? r.table_name : `${r.schema}.${r.table_name}`,
    name: r.name, def: norm(r.def),
  }));

// functions
snap.functions = (await q(`
  select n.nspname as schema, p.proname as name,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as returns,
         l.lanname as language, p.provolatile as volatility, p.prosecdef as security_definer,
         coalesce(pg_get_functiondef(p.oid), '') as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f'
  order by 1,2,3`))
  .map((r) => ({
    name: r.schema === "public" ? r.name : `${r.schema}.${r.name}`,
    args: r.args, returns: r.returns, language: r.language,
    volatility: r.volatility, security_definer: r.security_definer,
    def: norm(r.def),
  }));

// views
snap.views = (await q(`
  select n.nspname as schema, c.relname as name, pg_get_viewdef(c.oid) as def
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname not in ('pg_catalog','information_schema') and c.relkind in ('v','m')
  order by 1,2`))
  .map((r) => ({
    name: r.schema === "public" ? r.name : `${r.schema}.${r.name}`,
    materialized: r.def && false, def: norm(r.def),
  }));

// row level security + policies
snap.policies = (await q(`
  select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
  from pg_policies where schemaname not in ('pg_catalog','information_schema')
  order by 1,2,3`))
  .map((r) => ({
    table: r.schemaname === "public" ? r.tablename : `${r.schemaname}.${r.tablename}`,
    name: r.policyname, cmd: r.cmd, permissive: r.permissive,
    roles: [...r.roles].sort().join(","),
    qual: norm(r.qual), with_check: norm(r.with_check),
  }));

// sequences (structure only)
snap.sequences = (await q(`
  select n.nspname as schema, c.relname as name
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='S' and n.nspname not in ('pg_catalog','information_schema')
  order by 1,2`))
  .map((r) => (r.schema === "public" ? r.name : `${r.schema}.${r.name}`));

// table-level privileges (grants to non-owner roles)
snap.grants = (await q(`
  select table_schema, table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
  from information_schema.role_table_grants
  where table_schema not in ('pg_catalog','information_schema')
  group by 1,2,3 order by 1,2,3`))
  .map((r) => ({
    table: r.table_schema === "public" ? r.table_name : `${r.table_schema}.${r.table_name}`,
    grantee: r.grantee, privs: r.privs,
  }));

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(snap, null, 1));
console.log(`snapshot -> ${out}`);
console.log(`  tables=${snap.tables.length} columns=${snap.columns.length} constraints=${snap.constraints.length} indexes=${snap.indexes.length} triggers=${snap.triggers.length} functions=${snap.functions.length} views=${snap.views.length} policies=${snap.policies.length} grants=${snap.grants.length} sequences=${snap.sequences.length}`);
await db.end();
