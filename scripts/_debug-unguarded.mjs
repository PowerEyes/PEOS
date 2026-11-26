// Scan migration files for object-creating statements that lack an idempotence
// guard (no preceding `drop ... if exists`, no `create ... if not exists`,
// no `create or replace`). Reports file:line for each hit.
//
//   node scripts/_debug-unguarded.mjs            # scans the 30 pending files
import { readdir, readFile } from "node:fs/promises";

const inv = JSON.parse(await readFile("docs/sql/inventory.json", "utf8"));
const applied = new Set(inv.files.filter((f) => f.applied && f.dir === "migrations").map((f) => f.version));
const entries = (await readdir("supabase/migrations")).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
const pending = entries.filter((f) => !applied.has(f.slice(0, f.indexOf("_"))));

const CREATE = [
  ["policy", /^\s*create policy\s+("?[\w.]+"?)\s+on\s+/i],
  ["trigger", /^\s*create trigger\s+("?[\w]+"?)\s+/i],
  ["index", /^\s*create (unique )?index\s+(?!if not exists)/i],
  ["view", /^\s*create view\s+(?!or replace)/i],
  ["table", /^\s*create table\s+(?!if not exists)/i],
  ["function", /^\s*create function\s+(?!or replace)/i],
];

let total = 0;
for (const file of pending) {
  const text = await readFile(`supabase/migrations/${file}`, "utf8");
  const lines = text.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [kind, re] of CREATE) {
      if (re.test(line)) {
        // look back up to 6 lines for a matching guard for this object name
        const nameMatch = /(?:create (?:unique )?(?:policy|trigger|index|view|table|function)\s+(?:if not exists\s+)?)("?[\w]+"?)/i.exec(line);
        const name = nameMatch ? nameMatch[1].replace(/"/g, "") : "";
        const window = lines.slice(Math.max(0, i - 6), i).join("\n").toLowerCase();
        const guarded =
          window.includes(`drop ${kind} if exists ${name.toLowerCase()}`) ||
          window.includes(`drop ${kind} if exists`) && window.includes(name.toLowerCase()) ||
          (kind === "table" && /create table if not exists/i.test(line)) ||
          (kind === "function" && /create or replace/i.test(line)) ||
          (kind === "view" && /create or replace/i.test(line)) ||
          (kind === "index" && /if not exists/i.test(line));
        if (!guarded) hits.push(`  ${file}:${i + 1} [${kind}] ${line.trim().slice(0, 110)}`);
        break;
      }
    }
  }
  if (hits.length) {
    total += hits.length;
    console.log(`${file}`);
    for (const h of hits) console.log(h);
  }
}
console.log(`\n${total} unguarded create statement(s) across ${pending.length} pending files`);
