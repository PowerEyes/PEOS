// temporary diagnostic: why are trigger statements not classified?
import { readFile } from "node:fs/promises";

function splitStatements(sql) {
  const out = [];
  let cur = "", i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") { const j = sql.indexOf("\n", i); cur += sql.slice(i, j < 0 ? sql.length : j); i = j < 0 ? sql.length : j; continue; }
    if (c === "'") { let j = i + 1; while (j < sql.length) { if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; } j++; } cur += sql.slice(i, j + 1); i = j + 1; continue; }
    if (c === "$") { const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i)); if (m) { const tag = m[0]; const j = sql.indexOf(tag, i + tag.length); const end = j < 0 ? sql.length - 1 : j + tag.length - 1; cur += sql.slice(i, end + 1); i = end + 1; continue; } }
    if (c === ";") { out.push(cur); cur = ""; i++; continue; }
    cur += c; i++;
  }
  out.push(cur);
  return out;
}
const stripComments = (s) => { let t = s; while (/^\s*--/.test(t)) t = t.replace(/^\s*--[^\n]*\n?/, ""); return t.trim(); };

const dump = await readFile("docs/sql/backup/prod-schema-2026-11-24.sql", "utf8");
const stmts = splitStatements(dump).map(stripComments).filter(Boolean);
console.log("total statements:", stmts.length);

const trg = stmts.filter((s) => s.includes("CREATE OR REPLACE TRIGGER"));
console.log("containing trigger keyword:", trg.length);
console.log("starting with it:", trg.filter((s) => s.startsWith("CREATE OR REPLACE TRIGGER")).length);
const bad = trg.filter((s) => !s.startsWith("CREATE OR REPLACE TRIGGER"));
console.log("not-starting sample:", JSON.stringify((bad[0] ?? "").slice(0, 300)));

const portal = stmts.filter((s) => s.includes("portal_appointment_created"));
console.log("portal_appointment_created:", portal.length, portal.map((s) => JSON.stringify(s.slice(0, 100))));

// how many statements have a huge length (possible merge/desync)?
const big = stmts.filter((s) => s.length > 20000);
console.log("statements >20KB:", big.length, big.map((s) => s.slice(0, 60)));
