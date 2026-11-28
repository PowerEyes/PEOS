/** Converts the browser cart (including the combined frame+lens item written by
 * LensConfigurator) into the simple, mutually exclusive lines expected by
 * checkout_quotes and place_sale.
 *
 * Keeping this in one pure helper means the cart, quote and RPC all agree on
 * what a valid line is. It is safe to call on legacy carts too.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NormalizedCartLine = {
  kind: "product" | "lens";
  productId?: string;
  lensPackageId?: string;
  optionIds: string[];
  qty: number;
  usage: string | null;
  requires_rx: boolean;
  requires_add: boolean;
  rx: any;
};

const validUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function codeOf(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object") {
    const code = (value as any).code ?? (value as any).key;
    return typeof code === "string" && code ? code : null;
  }
  return null;
}

export function normalizeCartItems(items: any[]): { lines: NormalizedCartLine[]; error?: string } {
  if (!Array.isArray(items) || !items.length) return { lines: [], error: "Your cart is empty or invalid." };

  const lines: NormalizedCartLine[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return { lines: [], error: "Your cart has an invalid item. Refresh and try again." };
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return { lines: [], error: "Cart quantities must be between 1 and 10." };
    }

    const hasProduct = item.productId != null && item.productId !== "";
    const hasLens = item.lensPackageId != null && item.lensPackageId !== "";
    if (!hasProduct && !hasLens) return { lines: [], error: "Your cart has an invalid item. Refresh and try again." };
    if (hasProduct && !validUuid(item.productId)) return { lines: [], error: "Your cart has an invalid item. Refresh and try again." };
    if (hasLens && !validUuid(item.lensPackageId)) return { lines: [], error: "Your cart has an invalid item. Refresh and try again." };

    const usage = codeOf(item.usage);
    const requiresRx = item.requires_rx == null ? usage !== "non_rx" : Boolean(item.requires_rx);
    const requiresAdd = item.requires_add == null
      ? ["progressive", "reading", "bifocal"].includes(usage ?? "")
      : Boolean(item.requires_add);
    const rx = item.rx ?? item.prescription ?? null;

    // A frame-only / product card can carry optionIds in old carts. Product
    // lines never price options, so drop them instead of rejecting the cart.
    if (hasProduct) {
      lines.push({
        kind: "product", productId: item.productId, optionIds: [], qty,
        usage: null, requires_rx: false, requires_add: false, rx: null,
      });
    }

    if (hasLens) {
      const rawOptions = item.optionIds ?? [];
      if (rawOptions != null && !Array.isArray(rawOptions)) {
        return { lines: [], error: "Your cart has an invalid item. Refresh and try again." };
      }
      const optionIds: string[] = rawOptions;
      if (optionIds.length > 20 || optionIds.some((id) => !validUuid(id)) || new Set(optionIds).size !== optionIds.length) {
        return { lines: [], error: "Your cart has an invalid lens option. Refresh and try again." };
      }
      lines.push({ kind: "lens", lensPackageId: item.lensPackageId, optionIds, qty, usage, requires_rx: requiresRx, requires_add: requiresAdd, rx });
    }
  }

  if (!lines.length || lines.length > 100) {
    return { lines: [], error: "Your cart is too large to checkout. Remove some items and try again." };
  }
  return { lines };
}
