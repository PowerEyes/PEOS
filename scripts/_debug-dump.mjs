// temporary diagnostic: dump formats for sequences, table grants, file-table checks
import { readFile } from "node:fs/promises";

const d = await readFile("docs/sql/backup/prod-schema-2026-11-24.sql", "utf8");

const show = (label, needle, before = 80, after = 220) => {
  const i = d.indexOf(needle);
  console.log(`\n== ${label}: ${i < 0 ? "ABSENT" : JSON.stringify(d.slice(Math.max(0, i - before), i + after))}`);
};

show("customer_number_seq (sequence create)", "customer_number_seq");
show("grant on customer_notifications", 'ON TABLE "public"."customer_notifications"');
show("brands manufacturer check", "brands_manufacturer_status_check");
show("cart_items qty check", "cart_items_qty_check");
show("lens palre tier check", "lens_packages_pkey");

// how many CREATE SEQUENCE lines exist at all?
const seqLines = d.match(/^CREATE SEQUENCE.*$/gm) || [];
console.log("\nCREATE SEQUENCE statements:", seqLines.length);
console.log(seqLines.slice(0, 8));

// sample of a table-level GRANT (any) to postgres
const pg = d.match(/^GRANT [^\n]*TO "postgres";$/gm) || [];
console.log("\nGRANT ... TO postgres lines:", pg.length, pg.slice(0, 4));

// grants on customer_notifications: show all
const cn = d.match(/^GRANT[^\n]*customer_notifications[^\n]*$/gm) || [];
console.log("\nGRANT lines mentioning customer_notifications:", cn.length, cn.slice(0, 6));

// does the dump contain ALTER TABLE ... brands ADD CONSTRAINT (checks)?
const bc = d.match(/^ALTER TABLE[^\n]*brands[^\n]*ADD CONSTRAINT[^\n]*$/gm) || [];
console.log("\nALTER TABLE brands ADD CONSTRAINT:", bc.length, bc.slice(0, 4));

// lens_packages checks
const lp = d.match(/^ALTER TABLE[^\n]*lens_packages[^\n]*ADD CONSTRAINT[^\n]*$/gm) || [];
console.log("\nALTER TABLE lens_packages ADD CONSTRAINT:", lp.length, lp.slice(0, 6));

// cart_items
const ci = d.match(/^ALTER TABLE[^\n]*cart_items[^\n]*ADD CONSTRAINT[^\n]*$/gm) || [];
console.log("\nALTER TABLE cart_items ADD CONSTRAINT:", ci.length, ci.slice(0, 6));
