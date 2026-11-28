// verify: PG versions, MAINTAIN in snapshots, owner-grant rows on fresh
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

if (!process.env.LOCAL_DATABASE_URL) throw new Error("LOCAL_DATABASE_URL is required");
if (!process.env.SCRATCH_DATABASE_URL) throw new Error("SCRATCH_DATABASE_URL is required");

const tryExec = (c) => { try { return execSync(c, { encoding: "utf8", timeout: 15000 }).trim(); } catch (e) { return "ERR: " + String(e.message).split("\n")[0]; } };

console.log("local 54522:", tryExec(`psql "${process.env.LOCAL_DATABASE_URL}" -tAc "select version()"`));
console.log("qa_restore 5433:", tryExec(`psql "${process.env.SCRATCH_DATABASE_URL}" -tAc "select version()"`));

const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));
const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));

const maint = (s) => (s.grants ?? []).filter((g) => String(g.privs).includes("MAINTAIN")).length;
console.log("fresh grants with MAINTAIN:", maint(fresh), "| upgrade grants with MAINTAIN:", maint(upg));

const has = (s, k) => (s.grants ?? []).some((g) => `${g.table}->${g.grantee}` === k);
console.log("fresh profiles->postgres:", has(fresh, "profiles->postgres"),
  "| fresh brands->postgres:", has(fresh, "brands->postgres"),
  "| upgrade customer_notifications->postgres:", has(upg, "customer_notifications->postgres"));

// do fresh file tables carry ->postgres at all?
const pgRows = (fresh.grants ?? []).filter((g) => g.grantee === "postgres" && !String(g.table).includes(".")).slice(0, 6);
console.log("fresh public postgres-grant sample:", pgRows);
