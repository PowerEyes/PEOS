// Check distinct lens_packages.design values in the prod data backup.
import { readFileSync } from "node:fs";

const txt = readFileSync("docs/sql/backup/prod-data-2026-11-24.sql", "utf8");
const m = txt.match(/INSERT INTO "public"."lens_packages" \(([^)]+)\) VALUES([\s\S]*?);\n/);
if (!m) { console.log("no INSERT found for lens_packages (table may be empty)"); process.exit(0); }

const cols = m[1].split(",").map((s) => s.trim().replace(/"/g, ""));
const idx = cols.indexOf("design");
console.log("columns:", cols.length, "| design idx:", idx);
if (idx < 0) process.exit(0);

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

const rows = m[2].split(/\n\t\(/);
const vals = new Map();
let n = 0;
for (let i = 1; i < rows.length; i++) {
  const f = splitRow(rows[i].replace(/\),?$/, ""));
  if (f[idx] === undefined) continue;
  n++;
  vals.set(f[idx], (vals.get(f[idx]) ?? 0) + 1);
}
console.log("rows:", n, "| distinct design:", [...vals.entries()].map(([k, v]) => `${k}×${v}`).join(" | "));
