// One-shot evidence collector: prints the production facts the migration audit
// docs cite (place_sale bug state, RLS/grant drift, permission model state).
//   node scripts/sql-prod-facts.mjs
import pg from "pg";

const dsn = process.env.DATABASE_URL ??
  "postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
const db = new pg.Client({ connectionString: dsn, ssl: { rejectUnauthorized: false } });
await db.connect();
const one = async (sql) => (await db.query(sql)).rows;

const fn = async (name) => (await one(`select pg_get_functiondef(p.oid) as d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='${name}'`))[0]?.d ?? "";

const placeSale = await fn("place_sale");
console.log("place_sale:");
console.log("  array + bug present        :", /v_product_ids\s*:=\s*v_product_ids\s*\+/.test(placeSale));
console.log("  array || fix present       :", /v_product_ids\s*:=\s*v_product_ids\s*\|\|/.test(placeSale));
console.log("  product_costs posting      :", /product_costs/.test(placeSale));
console.log("  coalesce(current_org()...) :", /coalesce\(\s*current_org\(\)/.test(placeSale));

const hasPerm = await fn("has_permission");
console.log("has_permission uses has_perm:", /has_perm\s*\(/.test(hasPerm));

const nextCode = await fn("next_code");
console.log("next_code uses v_prefix     :", /v_prefix/.test(nextCode));

const trg = await one(`select c.relname||'.'||t.tgname as t from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
    and (t.tgname like '%patient%' or pg_get_triggerdef(t.oid) ilike '%patient_customer_id%')`);
console.log("patient backfill triggers    :", trg.map((r) => r.t).join(", ") || "(none)");

const salesTrg = await one(`select t.tgname from pg_trigger t where t.tgrelid='sales'::regclass and not t.tgisinternal`);
console.log("sales triggers               :", salesTrg.map((r) => r.tgname).join(", "));

const pol = await one(`select schemaname||'.'||tablename||'.'||policyname as p, qual, with_check
  from pg_policies where schemaname='public'
    and policyname in ('perm_read','branches_active_read','reviews_insert')
  order by 1`);
for (const p of pol) console.log(`policy ${p.p}: qual=${(p.qual || "-").slice(0, 90)} wc=${(p.with_check || "-").slice(0, 60)}`);

const wide = await one(`select grantee, count(*) as n from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated')
    and privilege_type in ('INSERT','UPDATE','DELETE')
    and table_name in ('audit_log','profiles','staff_assignments','org_domains','branch_transfers')
  group by grantee order by grantee`);
console.log("wide DML grants (should be 0 per files):", JSON.stringify(wide));

const famCols = await one(`select string_agg(column_name, ',' order by ordinal_position) as cols
  from information_schema.columns where table_name='family_members'`);
console.log("family_members columns       :", famCols[0].cols);

const rp = await one(`select string_agg(column_name, ',' order by ordinal_position) as cols
  from information_schema.columns where table_name='role_permissions'`);
console.log("role_permissions columns     :", rp[0].cols);

await db.end();
