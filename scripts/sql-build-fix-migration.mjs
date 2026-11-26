// Generates supabase/migrations/20261217000000_fix_schema_drift.sql
//
// Converges production (restored + the 28 unrecorded migrations = upgrade.json)
// onto the file-defined schema (fresh.json), i.e. the residue the pending
// migrations do not fix on their own:
//   A  role_permissions.id (BUG-001) + permission FK
//   B  family_members file-side columns + backfill + FK convergence
//   C  cart_items nullability + cascade FKs
//   D  purchase_invoices nullability, status default, status check
//   E  lab_orders / sales patient FK -> ON DELETE SET NULL
//   F  lens_packages design check
//   G  23 drifted + 5 missing RLS policies -> files' definitions
//   H  place_sale -> files' body (prescription expiry / approval gates)
//   I  next_code -> files' body + production's cross-org guard re-injected
// Grants: none (live prod vs fresh = 0 changed grants).
//
// Sources:
//   docs/sql/snapshots/upgrade.json + fresh.json  (structure diff + assertions)
//   live fresh Postgres 127.0.0.1:54522           (policy + function bodies)
//
// Usage: node scripts/sql-build-fix-migration.mjs
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const OUT = "supabase/migrations/20261217000000_fix_schema_drift.sql";
const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54522/postgres";

const upg = JSON.parse(readFileSync("docs/sql/snapshots/upgrade.json", "utf8"));
const fresh = JSON.parse(readFileSync("docs/sql/snapshots/fresh.json", "utf8"));

// ── diff helpers (mirror sql-schema-diff.mjs exactly) ────────────────────────
const PLATFORM_RE = /^(auth|storage|realtime|_realtime|vault|extensions|graphql|graphql_public|pgbouncer|supabase_migrations|supabase_functions|net|cron|pgsodium|jwt|private|solana|pg_toast|pg_catalog|information_schema)\b/;
const flt = (rows) =>
  rows.filter((r) => {
    const t = String(r.table ?? (typeof r === "string" ? r : r.name) ?? "");
    return !PLATFORM_RE.test(t);
  });
const M = (rows, key) => new Map(flt(rows).map((r) => [key(r), r]));
const kCol = (r) => `${r.table}.${r.name}`;
const kCon = (r) => `${r.table}#${r.name}`;
const kPol = (r) => `${r.table}.${r.name}`;
const kFn = (r) => `${r.name}(${r.args})`;

const changedKeys = (aRows, bRows, key) => {
  const a = M(aRows, key), b = M(bRows, key);
  return [...b.keys()].filter((k) => a.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k))).sort();
};
const freshOnlyKeys = (aRows, bRows, key) => {
  const a = M(aRows, key), b = M(bRows, key);
  return [...b.keys()].filter((k) => !a.has(k)).sort();
};

const assertEq = (label, actual, expected) => {
  const A = JSON.stringify([...actual].sort());
  const E = JSON.stringify([...expected].sort());
  if (A !== E) throw new Error(`${label} mismatch:\n  actual  ${A}\n  expected ${E}`);
  console.log(`assert ok: ${label} = ${actual.length}`);
};

// ── expected residue (validated diffs; see docs/sql/) ────────────────────────
assertEq("changed columns", changedKeys(upg.columns, fresh.columns, kCol), [
  "cart_items.org_id", "cart_items.product_id",
  "family_members.created_at", "family_members.relationship",
  "purchase_invoices.branch_id", "purchase_invoices.status", "purchase_invoices.updated_at",
]);
assertEq("fresh-only columns", freshOnlyKeys(upg.columns, fresh.columns, kCol), [
  "family_members.customer_id", "family_members.dob", "family_members.gender",
  "family_members.name", "family_members.notes", "family_members.phone",
  "role_permissions.id",
]);
assertEq("changed constraints", changedKeys(upg.constraints, fresh.constraints, kCon), [
  "cart_items#cart_items_customer_id_fkey",
  "cart_items#cart_items_product_id_fkey",
  "family_members#family_members_org_id_fkey",
  "lab_orders#lab_orders_patient_customer_id_fkey",
  "purchase_invoices#purchase_invoices_status_check",
  "sales#sales_patient_customer_id_fkey",
]);
assertEq("fresh-only constraints", freshOnlyKeys(upg.constraints, fresh.constraints, kCon), [
  "family_members#family_members_customer_id_fkey",
  "lens_packages#lens_packages_design_check",
  "role_permissions#role_permissions_permission_fkey",
]);
assertEq("changed policies", changedKeys(upg.policies, fresh.policies, kPol), [
  "brands.brands_rls_ins", "brands.brands_rls_upd",
  "cashbook.cashbook_rls_sel",
  "day_closings.day_closings_rls_ins", "day_closings.day_closings_rls_sel", "day_closings.day_closings_rls_upd",
  "expenses.expenses_rls_ins", "expenses.expenses_rls_sel", "expenses.expenses_rls_upd",
  "gst_periods.gst_periods_rls_ins", "gst_periods.gst_periods_rls_sel", "gst_periods.gst_periods_rls_upd",
  "lens_options.lens_options_rls_ins", "lens_options.lens_options_rls_upd",
  "lens_packages.lens_packages_rls_ins", "lens_packages.lens_packages_rls_upd",
  "products.products_rls_ins", "products.products_rls_upd",
  "purchase_invoices.purchase_invoices_rls_ins", "purchase_invoices.purchase_invoices_rls_sel", "purchase_invoices.purchase_invoices_rls_upd",
  "suppliers.suppliers_rls_ins", "suppliers.suppliers_rls_upd",
]);
assertEq("fresh-only policies", freshOnlyKeys(upg.policies, fresh.policies, kPol), [
  "family_members.fm_customer", "family_members.fm_staff",
  "gst_periods.perm_read", "purchase_items.perm_read", "suppliers.perm_read",
]);
assertEq("changed functions", changedKeys(upg.functions, fresh.functions, kFn), [
  "next_code(p_org uuid, p_key text, p_prefix text)",
  "place_sale(p jsonb)",
]);
assertEq("changed grants (prod vs fresh)", changedKeys(
  JSON.parse(readFileSync("docs/sql/snapshots/prod.json", "utf8")).grants, fresh.grants,
  (r) => `${r.table}->${r.grantee}`), []);

// target definitions from the snapshots
const con = (snap, table, name) => snap.constraints.find((c) => c.table === table && c.name === name);
const needCon = (snap, table, name) => {
  const c = con(snap, table, name);
  if (!c) throw new Error(`constraint ${table}#${name} not found in snapshot`);
  return c.def;
};

// ── live fresh: policies + function bodies ───────────────────────────────────
const db = new pg.Client({ connectionString: LOCAL });
await db.connect();
const polKeys = [
  ...changedKeys(upg.policies, fresh.policies, kPol),
  ...freshOnlyKeys(upg.policies, fresh.policies, kPol),
];
const polSet = new Set(polKeys);
const { rows: polRows } = await db.query(
  `select tablename, policyname, permissive, cmd,
          array_to_string(roles, ' ') as roles, qual, with_check
     from pg_policies where schemaname = 'public'`
);
const live = new Map(polRows.map((r) => [`${r.tablename}.${r.policyname}`, r]));
for (const k of polKeys) if (!live.has(k)) throw new Error(`policy ${k} not found in live fresh`);

// snapshot vs live freshness check (roles excluded — snapshot stores them
// char-sorted; bodies must be identical to fresh.json or the snapshots are stale)
const snapPol = M(fresh.policies, kPol);
const norm = (v) => (v == null || v === "" ? null : v.replace(/\s+/g, " ").trim()); // "" for absent clauses; snapshot collapses whitespace
for (const k of polKeys) {
  const s = snapPol.get(k), l = live.get(k);
  for (const f of ["cmd", "permissive", "qual", "with_check"]) {
    if (norm(s[f]) !== norm(l[f])) {
      throw new Error(`policy ${k} field ${f} differs snapshot vs live — rerun sql-schema-snapshot first`);
    }
  }
}
console.log(`assert ok: ${polKeys.length} policies match live fresh`);

const fnDef = async (sig) => {
  const name = sig.replace(/\(.*$/, "");
  const { rows } = await db.query(
    `select pg_get_functiondef(p.oid) as def from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`,
    [name]
  );
  if (rows.length !== 1) throw new Error(`${name}: expected 1 overload, got ${rows.length}`);
  return rows[0].def.trim().replace(/;$/, "");
};
const placeSaleDef = await fnDef("place_sale(p jsonb)");
if (!placeSaleDef.includes("This prescription has expired")) {
  throw new Error("place_sale live body lacks the expiry check — wrong database state?");
}
const nextCodeRaw = await fnDef("next_code(p_org uuid, p_key text, p_prefix text)");

// next_code: files' body (org_settings code_prefixes) + production's cross-org
// guard (from the quarantined multi_branch_rbac file, applied to production) —
// neither side may regress. The guard lives in upgrade.json's body verbatim.
const upgNext = M(upg.functions, kFn).get("next_code(p_org uuid, p_key text, p_prefix text)");
const guardMatch = /if current_org\(\) is not null and p_org is distinct from current_org\(\) then\s*raise exception 'Access denied' using errcode = '42501';\s*end if;/.exec(upgNext.def);
if (!guardMatch) throw new Error("cross-org guard not found in upgrade next_code body");
let nextCodeDef = nextCodeRaw;
if (!nextCodeDef.includes("Access denied")) {
  const dq = nextCodeDef.indexOf("$function$");
  const start = dq >= 0 ? dq + "$function$".length : 0;
  const m = /\bbegin\b/i.exec(nextCodeDef.slice(start));
  if (!m) throw new Error("next_code: no begin keyword to inject the guard after");
  const at = start + m.index + m[0].length;
  nextCodeDef = `${nextCodeDef.slice(0, at)}\n  ${guardMatch[0]}\n${nextCodeDef.slice(at)}`;
}
if (!nextCodeDef.includes("Access denied") || !nextCodeDef.includes("code_prefixes")) {
  throw new Error("next_code patch incomplete — needs both the guard and code_prefixes support");
}
await db.end();

// ── statement helpers (all repeat-safe) ──────────────────────────────────────
const setNotNull = (table, column) => `do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = '${table}'
               and column_name = '${column}' and is_nullable = 'YES') then
    if not exists (select 1 from public.${table} where ${column} is null) then
      alter table public.${table} alter column ${column} set not null;
    else
      raise notice '${table}.${column} has NULL rows — NOT NULL skipped';
    end if;
  end if;
end $$;`;
const addCon = (table, name, def) => `do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = '${name}' and conrelid = 'public.${table}'::regclass) then
    alter table public.${table} add constraint ${name} ${def};
  end if;
end $$;`;
const replaceCon = (table, name, def) => `do $$
begin
  if exists (select 1 from pg_constraint
             where conname = '${name}' and conrelid = 'public.${table}'::regclass) then
    alter table public.${table} drop constraint ${name};
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = '${name}' and conrelid = 'public.${table}'::regclass) then
    alter table public.${table} add constraint ${name} ${def};
  end if;
end $$;`;
const semicolon = (s) => (s.trim().endsWith(";") ? s.trim() : s.trim() + ";");
const parts = [];
const section = (title, note, stmts) => {
  parts.push(`-- ${title} ${"─".repeat(Math.max(4, 76 - title.length))}`);
  if (note) parts.push(`-- ${note}`);
  for (const st of stmts) parts.push(semicolon(st));
  parts.push("");
};

// ── A. role_permissions ──────────────────────────────────────────────────────
section("A. role_permissions — BUG-001 id column + permission FK", `ledger records 20261123000000 as applied on production but its
-- 'add column id' never landed, so trg_roleperm_audit (NEW.id) fails on every
-- role_permissions write. Volatile default: existing rows (4) are filled
-- immediately; the permission FK is safe because pending file 20261128000000
-- (sorts earlier) rewrites legacy dotted permission rows into the catalogue's
-- current names before this runs.`, [
  `alter table public.role_permissions add column if not exists id uuid not null default gen_random_uuid();`,
  addCon("role_permissions", "role_permissions_permission_fkey",
    "FOREIGN KEY (permission) REFERENCES permission_catalog(key)"),
]);

// ── B. family_members ────────────────────────────────────────────────────────
section("B. family_members — file-side columns, backfill, FK convergence", `Dual model: production carries the portal model (primary/member customer
-- ids, member_label); the files carry the customer-owned model (customer_id +
-- person details, 0016). Additive both ways — 0 rows in production, and the
-- production-side columns arrive on fresh via 20261218000000, so the backfill
-- only runs where they already exist. customer_id := the requesting (primary)
-- customer — matches the fm_customer policy; name := the member's name.`, [
  `alter table public.family_members add column if not exists customer_id uuid;`,
  `alter table public.family_members add column if not exists name text;`,
  `alter table public.family_members add column if not exists dob date;`,
  `alter table public.family_members add column if not exists gender text;`,
  `alter table public.family_members add column if not exists phone text;`,
  `alter table public.family_members add column if not exists notes text;`,
  `do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'family_members'
               and column_name = 'primary_customer_id') then
    execute 'update public.family_members set customer_id = primary_customer_id
             where customer_id is null and primary_customer_id is not null';
    execute 'update public.family_members set name = member_label
             where name is null and member_label is not null';
  end if;
end $$;`,
  setNotNull("family_members", "customer_id"),
  setNotNull("family_members", "name"),
  `alter table public.family_members alter column relationship set default 'family';`,
  `alter table public.family_members alter column created_at drop not null;`,
  addCon("family_members", "family_members_customer_id_fkey",
    needCon(fresh, "family_members", "family_members_customer_id_fkey")),
  replaceCon("family_members", "family_members_org_id_fkey",
    needCon(upg, "family_members", "family_members_org_id_fkey")),
]);

// ── C. cart_items ────────────────────────────────────────────────────────────
section("C. cart_items — files' nullability, production's cascade rules", `org_id becomes NOT NULL (files), product_id stops being NOT NULL (files:
-- lens-package lines carry no product_id), and both FKs take production's
-- ON DELETE CASCADE so deleting a product/customer clears its cart lines
-- instead of erroring. 0 rows in production.`, [
  setNotNull("cart_items", "org_id"),
  `alter table public.cart_items alter column product_id drop not null;`,
  replaceCon("cart_items", "cart_items_product_id_fkey",
    needCon(upg, "cart_items", "cart_items_product_id_fkey")),
  replaceCon("cart_items", "cart_items_customer_id_fkey",
    needCon(upg, "cart_items", "cart_items_customer_id_fkey")),
]);

// ── D. purchase_invoices ─────────────────────────────────────────────────────
section("D. purchase_invoices — nullability, status default, status check", `Files default to 'unpaid'; production's 37 rows are all 'pending', which
-- the widened check still accepts (verified against the 2026-11-24 backup:
-- 0 NULL branch_id / updated_at).`, [
  `alter table public.purchase_invoices alter column status set default 'unpaid';`,
  setNotNull("purchase_invoices", "branch_id"),
  setNotNull("purchase_invoices", "updated_at"),
  replaceCon("purchase_invoices", "purchase_invoices_status_check",
    needCon(fresh, "purchase_invoices", "purchase_invoices_status_check")),
]);

// ── E. patient FKs ───────────────────────────────────────────────────────────
section("E. lab_orders / sales — patient FK ON DELETE SET NULL", `Production leaves NO ACTION, which blocks deleting a customer who has
-- lab orders or sales; the files' ON DELETE SET NULL is the intended
-- behaviour (same fix as pending file 20261125010000).`, [
  replaceCon("lab_orders", "lab_orders_patient_customer_id_fkey",
    needCon(fresh, "lab_orders", "lab_orders_patient_customer_id_fkey")),
  replaceCon("sales", "sales_patient_customer_id_fkey",
    needCon(fresh, "sales", "sales_patient_customer_id_fkey")),
]);

// ── F. lens_packages ─────────────────────────────────────────────────────────
section("F. lens_packages — design vocabulary check", `Files' definition; all 9 production rows already conform (single_vision /
-- progressive / reading / bifocal verified against the backup).`, [
  addCon("lens_packages", "lens_packages_design_check",
    needCon(fresh, "lens_packages", "lens_packages_design_check")),
]);

// ── G. policies ──────────────────────────────────────────────────────────────
const polStmts = [];
for (const k of [...polKeys].sort()) {
  const r = live.get(k);
  const roles = r.roles.split(" ").filter(Boolean).map((x) => `"${x}"`).join(", ");
  const cmd = r.cmd.toLowerCase();
  const perm = r.permissive.toLowerCase();
  polStmts.push(`drop policy if exists "${r.policyname}" on public.${r.tablename};
create policy "${r.policyname}" on public.${r.tablename} as ${perm} for ${cmd} to ${roles}${r.qual ? `\n  using (${r.qual})` : ""}${r.with_check ? `\n  with check (${r.with_check})` : ""};`);
}
section("G. RLS policies — files' definitions (23 drifted + 5 missing)",
  `Drifted policies widen production's is_manager() gates into the files'
-- has_perm(...) permission gates; the 5 fresh-only policies (family member
-- visibility + perm_read selects) do not exist on production. Drop + create is
-- idempotent; bodies read from live fresh.`, polStmts);

// ── H/I. functions ───────────────────────────────────────────────────────────
section("H. place_sale — files' body", `Production's body predates the prescription expiry and approval-gate
-- checks; the files' body is a strict superset and every column it touches
-- exists on production (verified). Full create-or-replace.`, [placeSaleDef]);
section("I. next_code — files' body + production's cross-org guard", `Production only has the cross-org guard (from the quarantined
-- multi_branch_rbac file), the files only the org_settings code_prefixes
-- support; the guard is re-injected after the first begin so neither side
-- regresses.`, [nextCodeDef]);

const header = `-- Fix schema drift between production and the file-defined schema.
--
-- GENERATED by scripts/sql-build-fix-migration.mjs from
-- docs/sql/snapshots/upgrade.json (production schema + the 28 unrecorded
-- migrations) and docs/sql/snapshots/fresh.json (all migrations), with policy
-- and function definitions read from the live fresh database. Regenerate
-- instead of hand-editing.
--
-- Ordering: sorts after every existing migration (20261216000000) and before
-- 20261218000000_recover_out_of_band_features.sql, which must run last.
-- Assumes the 28 unrecorded migrations (20261121030000 … 20261216000000) apply
-- first — supabase db push applies pending migrations in version order, so the
-- assumption holds automatically. Those files already converge most of the
-- drift (10 functions, 4 checks, 15 policies); this file covers the residue.
--
-- Repeat-safe: every statement is an idempotent add, a guarded drop+add or a
-- drop-if-exists + create — safe on a fresh install (all no-ops), on
-- production (the actual fix) and twice in a row.
--
-- Grants: none — live production vs fresh shows 0 changed grants (the earlier
-- "12 changed grants" were restore-shim artifacts; see docs/sql/OPEN_ISSUES.md).

`;

const sql = header + parts.join("\n") + "\n-- end of migration\n";

// final invariants
for (const [needle, label] of [
  ["add column if not exists id uuid", "BUG-001 column"],
  ["customer_id = primary_customer_id", "family backfill"],
  ["on delete cascade", "cascade FK targets"],
  ["on delete set null", "patient FK targets"],
  ["code_prefixes", "next_code prefix support"],
  ["Access denied", "next_code cross-org guard"],
  ["This prescription has expired", "place_sale expiry gate"],
  ["has_perm(", "permission-gated policies"],
]) {
  if (!sql.toLowerCase().includes(needle.toLowerCase())) throw new Error(`final invariant missing: ${label} (${needle})`);
}

writeFileSync(OUT, sql, "utf8");
console.log(`-> ${OUT} (${sql.length} bytes)`);
