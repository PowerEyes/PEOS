// Compare snapshot vs live policy qual/with_check for brands.brands_rls_ins.
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));
const snap = fresh.policies.find((p) => p.table === "family_members" && p.name === "fm_customer");
console.log("snapshot:", JSON.stringify(snap, null, 2));

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query(
  `select tablename, policyname, permissive, cmd, array_to_string(roles,' ') as roles, qual, with_check
     from pg_policies where schemaname='public' and tablename='family_members' and policyname='fm_customer'`
);
console.log("live    :", JSON.stringify(rows[0], null, 2));
await db.end();
