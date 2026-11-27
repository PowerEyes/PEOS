// Approve the 7 remaining @poweros.test profiles (auth users already exist
// with password PowerOS123!; only the profiles row needs the role/org now that
// profiles_role_key_chk allows all 11 keys). Also deletes the API probe user.
import { sb, log } from "./db.mjs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const BRANCH_EAST = "c1e79328-6a5e-4598-918f-3005f123e23c";
const ROLES = ["owner","admin","branch_manager","staff","optometrist","sales_executive","cashier","inventory_manager","lab_technician","accountant","receptionist"];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  // 1. Remove the API probe user.
  const probe = await client.query("select id from auth.users where email='probe-list-test@poweros.test'");
  if (probe.rows[0]) {
    const { error } = await sb.auth.admin.deleteUser(probe.rows[0].id);
    log(error ? `WARN probe delete: ${error.message}` : "ok   probe user deleted");
  }

  // 2. Approve every @poweros.test profile into the demo org with its role.
  let ok = 0, missing = 0;
  for (const role of ROLES) {
    const email = `${role}@poweros.test`;
    const u = await client.query("select id from auth.users where email=$1", [email]);
    if (!u.rows[0]) { log(`MISS ${email} (no auth user)`); missing++; continue; }
    const r = await client.query(
      `insert into profiles (id, org_id, full_name, role_key, is_approved, deactivated, branch_reviewed, branch_id)
       values ($1, $2, $3, $4, true, false, true, $5)
       on conflict (id) do update set org_id=excluded.org_id, full_name=excluded.full_name,
         role_key=excluded.role_key, is_approved=true, deactivated=false,
         branch_reviewed=true, branch_id=excluded.branch_id`,
      [u.rows[0].id, ORG_ID, `Test ${role}`, role,
       role === "owner" || role === "admin" ? null : BRANCH_EAST]);
    if (r.rowCount) { ok++; log(`ok   ${role.padEnd(18)} ${email}`); }
  }

  // 3. Backfill default role permissions for the demo org.
  await client.query("select public.seed_org_permissions($1)", [ORG_ID]);
  log("ok   role_permissions backfilled");

  const total = await client.query(
    `select count(*)::int as n from profiles p join auth.users u on u.id=p.id
      where u.email like '%@poweros.test' and p.is_approved and p.org_id=$1`, [ORG_ID]);
  log(`\ndone: ${ok} profiles approved, ${missing} missing, ${total.rows[0].n}/11 test logins ready`);
} finally {
  await client.end();
}
