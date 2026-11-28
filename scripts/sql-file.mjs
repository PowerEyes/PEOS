// Run a SQL file against the database: node scripts/sql-file.mjs <path-to.sql>
import fs from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const file = process.argv[2];
if (!file) { console.error("usage: node scripts/sql-file.mjs <file.sql>"); process.exit(1); }
const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("OK", file);
} finally { await client.end(); }
