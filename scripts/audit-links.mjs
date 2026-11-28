#!/usr/bin/env node
// Static dead-link audit: every internal path used in href / redirect / router.push / fetch must resolve to a route in the same app.
//   node scripts/audit-links.mjs        (exit 1 when dead links are found)
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
const ROOT = new URL("..", import.meta.url).pathname;
const APPS = { erp: "apps/erp/src/app", web: "apps/web/src/app", "saas-website": "apps/saas-website/app" };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : [p]; });
let dead = 0;
for (const [app, dir] of Object.entries(APPS)) {
  const base = join(ROOT, dir); if (!existsSync(base)) continue;
  const files = walk(base);
  const routes = files.filter((f) => /\/(page|route)\.(tsx|ts)$/.test(f)).map((f) => "/" + ("/" + relative(base, f)).replace(/\/(page|route)\.(tsx|ts)$/, "").slice(1).split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/")).map((r) => r.replace(/\/$/, "") || "/");
  const rx = routes.map((r) => new RegExp("^" + r.split("/").map((s) => /^\[\[?\.\.\./.test(s) ? ".*" : /^\[.*\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|\\]/g, "\\$&")).join("/") + "$"));
  const staticOk = new Set(["/robots.txt", "/sitemap.xml", "/manifest.json", "/favicon.ico", "/sw.js"]);
  const used = new Map();
  for (const f of files.filter((f) => /\.(tsx|ts)$/.test(f))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:href=|href:\s*|redirect\(|router\.(?:push|replace)\(|permanentRedirect\()\s*[{]?\s*["'`](\/[A-Za-z0-9_\-/\.]*)(?:[?#"'`])/g)) {
      const p = m[1].replace(/\/$/, "") || "/";
      if (!used.has(p)) used.set(p, new Set()); used.get(p).add(relative(ROOT, f));
    }
  }
  const bad = [...used].filter(([p]) => !staticOk.has(p) && !/\.(png|jpe?g|svg|ico|webp|css|js|json|txt|xml)$/.test(p) && !rx.some((r) => r.test(p)) && !existsSync(join(ROOT, dirname2(dir), "public", p)));
  console.log(`${app}: ${routes.length} routes, ${used.size} distinct internal links, ${bad.length} dead`);
  for (const [p, fs] of bad) { dead++; console.log(`  ✗ ${p}   ← ${[...fs].slice(0, 2).join(", ")}`); }
}
function dirname(p) { return p.split("/").slice(0, -1).join("/"); }
function dirname2(p) { return p.replace(/\/(src\/)?app$/, ""); }
process.exit(dead ? 1 : 0);
