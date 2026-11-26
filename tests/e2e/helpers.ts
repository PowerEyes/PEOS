import { Client } from "pg";

export const ORG_ID = "00000000-0000-0000-0000-000000000001";
export const BRANCH = {
  east: "c1e79328-6a5e-4598-918f-3005f123e23c",
  west: "f41906f4-9d95-48aa-80c1-bef031469632",
} as const;
export const BRANCH_NAME = { east: "Mogappair East", west: "Mogappair West" } as const;

/** The five pre-existing rows that are deliberately *not* part of the 375 seed. */
export const LEGACY_SKUS = ["FRM-0002", "FRM-0003", "FRM-0004", "SUN-0001", "CL-0001"];
export const SEEDED = `p.sku not in (${LEGACY_SKUS.map((s) => `'${s}'`).join(", ")})`;

const DSN = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

export async function rows<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
  if (!DSN) throw new Error("Set E2E_DATABASE_URL to a disposable test database before running database-backed E2E tests.");
  const client = new Client({ connectionString: DSN, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const r = await client.query(sql, params);
    return (r.rows ?? []) as T[];
  } finally {
    await client.end();
  }
}

export async function one<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await rows<T>(sql, params);
  return r[0] ?? null;
}

/** Runs a statement and reports the failure instead of throwing (for guard tests). */
export async function tryQuery(
  sql: string,
  params: any[] = [],
): Promise<{ ok: boolean; code?: string; message?: string }> {
  try {
    await rows(sql, params);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, code: e?.code, message: String(e?.message ?? e) };
  }
}

export const num = (v: any) => Number(v ?? 0);

/** First column of the first row, with numeric strings coerced to numbers. */
export async function scalar<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await one(sql, params);
  if (!r) return null;
  const v = Object.values(r)[0];
  if (v == null) return null;
  return (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v) as T;
}

/** `₹1,24,67,644` -> 12467644 */
export const inrToNumber = (s: string) => Number(String(s).replace(/[^\d.-]/g, ""));

/** Pulls `label` + the ₹ amount that follows it out of a page's innerText. */
export function amountAfter(text: string, label: string): number {
  const re = new RegExp(`${label}\\s*\\n\\s*₹\\s*([\\d,]+(?:\\.\\d+)?)`);
  const m = text.match(re);
  if (!m) throw new Error(`Could not find "${label}" followed by a ₹ amount in:\n${text.slice(0, 800)}`);
  return inrToNumber(m[1]);
}

/** Deterministic product picker shared by the specs so they never fight over rows. */
export async function pickProducts(kind: string, n: number, offset = 0) {
  return rows<{ id: string; sku: string; cost_price: string; tax_pct: string; model: string }>(
    `select id, sku, cost_price, tax_pct, model from products
      where kind = $1 and visible_on_website
      order by sku limit $2 offset $3`,
    [kind, n, offset],
  );
}

export async function stockQty(productIds: string[], branchId: string): Promise<Record<string, number>> {
  if (!productIds.length) return {};
  const r = await rows<{ product_id: string; qty: string }>(
    `select product_id, qty from stock where branch_id = $1 and product_id = any($2::uuid[])`,
    [branchId, productIds],
  );
  return Object.fromEntries(r.map((x) => [x.product_id, num(x.qty)]));
}

/** Polls until `check` returns truthy — used to ride out the 60s ISR window. */
export async function until<T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 90_000, everyMs = 2_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: any;
  while (Date.now() < deadline) {
    try {
      const v = await check();
      if (v) return v as T;
      last = v;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms (last: ${String(last)})`);
}

/** Unique-per-run tokens so the suite can be re-run against the same database. */
export const TOKEN = String(Date.now()).slice(-6);
