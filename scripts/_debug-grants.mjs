// compare grants: qa_restore (upgrade baseline) vs local fresh
import pg from "pg";

const qa = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5433/postgres" });
const fresh = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:54522/postgres" });
await qa.connect(); await fresh.connect();

const q = async (c, table) => (await c.query(
  `select grantee, string_agg(privilege_type, ',' order by privilege_type) p
   from information_schema.role_table_grants where table_name = $1 and table_schema='public'
   group by grantee order by grantee`, [table])).rows;

for (const t of ["brands", "audit_log", "profiles", "customer_notifications", "rate_limits"]) {
  const a = await q(qa, t), b = await q(fresh, t);
  console.log(`\n== ${t}`);
  console.log("  upgrade:", a.map((r) => `${r.grantee}=${r.p}`).join(" | ") || "(no table)");
  console.log("  fresh  :", b.map((r) => `${r.grantee}=${r.p}`).join(" | ") || "(no table)");
}

// default privileges present on each side?
for (const [label, c] of [["upgrade", qa], ["fresh", fresh]]) {
  const rows2 = (await c.query(
    `select n.nspname, r.rolname grantee, d.defaclobjtype t, pg_get_defaclacl(d.defaclobjtype, n.oid, d.defaclrole) acl
     from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace join pg_roles r on r.oid = d.defaclrole
     where n.nspname = 'public'`)).rows;
  console.log(`\n${label} default privileges in public:`, rows2.map((r) => `${r.grantee}/${r.t}=${r.acl}`).join(" | ") || "(none)");
}

await qa.end(); await fresh.end();
