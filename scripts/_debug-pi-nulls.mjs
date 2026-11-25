// Check NULL counts for purchase_invoices.branch_id / updated_at in the prod data backup.
import { readFileSync } from "node:fs";

const txt = readFileSync("docs/sql/backup/prod-data-2026-11-24.sql", "utf8");

// find the INSERT for purchase_invoices
const m = txt.match(/INSERT INTO "public"."purchase_invoices" \(([^)]+)\) VALUES([\s\S]*?);\n/);
if (!m) { console.log("no INSERT found for purchase_invoices"); process.exit(0); }

const cols = m[1].split(",").map((s) => s.trim().replace(/"/g, ""));
console.log("columns:", cols.join(", "));

// crude row splitter: rows start with \n\t( and end with ),
const body = m[2];
const rows = body.split(/\n\t\(/).map((r, i) => (i === 0 ? r : "(" + r));
console.log("row count:", rows.length);

// tokenizer respecting single quotes
function splitRow(s) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === "'") { if (s[i + 1] === "'") { cur += "''"; i++; } else { inQ = false; cur += c; } }
      else cur += c;
    } else {
      if (c === "'") { inQ = true; cur += c; }
      else if (c === ",") { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

for (const col of ["branch_id", "updated_at", "status"]) {
  const idx = cols.indexOf(col);
  if (idx < 0) { console.log(`${col}: NOT in column list`); continue; }
  let nulls = 0, vals = new Map();
  for (const r of rows) {
    const f = splitRow(r.replace(/^\(/, "").replace(/\),?$/, ""));
    const v = f[idx];
    if (v === undefined) continue;
    if (v === "NULL") nulls++;
    else vals.set(v, (vals.get(v) ?? 0) + 1);
  }
  console.log(`${col}: nulls=${nulls} distinct=${[...vals.entries()].slice(0, 8).map(([k, n]) => `${k}×${n}`).join(" | ")}`);
}
