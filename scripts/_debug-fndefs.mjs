// Print next_code + place_sale defs from fresh and upgrade snapshots.
import { readFileSync } from "node:fs";

const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));

const find = (rows, name) => rows.find((r) => r.name === name);

for (const fn of ["next_code", "place_sale"]) {
  for (const [label, snap] of [["FRESH", fresh], ["UPG", upg]]) {
    const r = find(snap.functions, fn);
    console.log(`\n===== ${fn} @ ${label} =====`);
    console.log(r ? r.def : "(not found)");
  }
}
