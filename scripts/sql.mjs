// Run arbitrary SQL: node scripts/sql.mjs "select ..."
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = process.argv.slice(2).join(" ");
if (!sql) { console.error("usage: node scripts/sql.mjs \"<sql>\""); process.exit(1); }
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const r = await client.query(sql);
  if (r.rows) console.log(JSON.stringify(r.rows, null, 1));
  else console.log("OK", r.command, r.rowCount);
} finally { await client.end(); }
