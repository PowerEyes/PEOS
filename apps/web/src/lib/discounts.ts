/** Client/server-safe helpers for the storefront discount cap.
 *
 * place_sale rejects discounts above the organisation's configured limit, so
 * the cart and the checkout quote must apply the same cap before payment. The
 * setting exists under a canonical key and a legacy key depending on which
 * migration an environment has run; both are accepted here.
 */

export const DISCOUNT_KEYS = ["sales.max_discount_pct", "max_staff_discount_pct"] as const;
export const DEFAULT_MAX_DISCOUNT_PCT = 10;

type SettingRow = { key?: string; value?: unknown };

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseNumber(parsed);
    } catch {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
  }
  if (value && typeof value === "object") {
    const nested = (value as any).value;
    if (nested !== undefined) return parseNumber(nested);
  }
  return null;
}

/** Reads the effective cap from an org_settings query result. */
export function maxDiscountFromSettings(rows: SettingRow[] | null | undefined): number {
  const byKey = new Map((rows ?? []).map((r) => [String(r.key), r.value]));
  for (const key of DISCOUNT_KEYS) {
    if (!byKey.has(key)) continue;
    const n = parseNumber(byKey.get(key));
    if (n !== null) return Math.min(100, Math.max(0, n));
  }
  return DEFAULT_MAX_DISCOUNT_PCT;
}

/** Fetch the cap with either a service or anon Supabase client. */
export async function getMaxDiscountPct(db: any, orgId: string): Promise<number> {
  try {
    const { data } = await db
      .from("org_settings")
      .select("key,value")
      .eq("org_id", orgId)
      .in("key", [...DISCOUNT_KEYS]);
    return maxDiscountFromSettings(data as SettingRow[] | null);
  } catch {
    return DEFAULT_MAX_DISCOUNT_PCT;
  }
}

export function applyDiscountCap(subtotal: number, requested: number, capPct: number) {
  const cap = (Math.max(0, subtotal) * Math.min(100, Math.max(0, capPct))) / 100;
  const discount = Math.round(Math.min(Math.max(0, requested), cap) * 100) / 100;
  return { discount, capPct, capped: requested > cap + 0.01, capAmount: Math.round(cap * 100) / 100 };
}
