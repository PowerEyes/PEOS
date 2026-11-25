// Syntax/semantics validation: run migration files inside a transaction and
// ROLLBACK — proves the SQL parses and resolves on a fresh-like database
// without persisting anything.
//   node scripts/sql-txn-validate.mjs <file.sql> [<file.sql> ...]
import { readFile } from "node:fs/promises";
import pg from "pg";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node scripts/sql-txn-validate.mjs <file.sql> [...]");
  process.exit(1);
}

const db = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:54522/postgres" });
await db.connect();

let failed = false;
for (const f of files) {
  const text = await readFile(f, "utf8");
  try {
    await db.query("BEGIN");
    await db.query(text);
    await db.query("ROLLBACK");
    console.log(`OK    ${f}`);
  } catch (e) {
    failed = true;
    try { await db.query("ROLLBACK"); } catch { /* ignore */ }
    console.log(`FAIL  ${f}\n      ${e.message}\n      position: ${e.position ?? "?"}`);
    // show the offending line if we can locate it
    if (e.position) {
      const upto = text.slice(0, Number(e.position));
      const line = upto.split("\n").length;
      const lines = text.split("\n");
      console.log(`      line ${line}: ${lines.slice(Math.max(0, line - 3), line + 2).join("\n      ")}`);
    }
  }
}
await db.end();
process.exit(failed ? 1 : 0);
