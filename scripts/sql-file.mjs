// Run a SQL file against the database: node scripts/sql-file.mjs <path-to.sql>
import fs from "node:fs";
import pg from "pg";
const file = process.argv[2];
if (!file) { console.error("usage: node scripts/sql-file.mjs <file.sql>"); process.exit(1); }
const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ??
    "postgresql://postgres.lnoagnobwrptbcdeshji:qcRKmqqz56pZ8b2F@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("OK", file);
} finally { await client.end(); }
