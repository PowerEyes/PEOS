"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

type R = { error?: string; ok?: string };

const payload = z.object({
  branch_id: z.string().uuid(),
  rows: z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(0).max(1000000) })).min(1).max(5000),
});

/**
 * Posts opening stock as stock_movements (reason = 'opening'), which is what
 * actually maintains the `stock` table via trg_apply_movement.
 *
 * Only rows the user left non-empty are posted, and a product that already has
 * stock at the branch is rejected — "opening" must never double-count. The
 * batch is all-or-nothing so a partial load can't be mistaken for a full one.
 */
export async function postOpeningStock(input: unknown): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const p = payload.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid opening stock rows." };

  const sb = supabaseServer();
  const { data: allowed } = await sb.rpc("has_perm", { p: "stock_adjust" });
  if (!allowed) return { error: "You do not have permission to post opening stock." };

  const { data: branch } = await sb.from("branches").select("id").eq("id", p.data.branch_id).maybeSingle();
  if (!branch) return { error: "Branch not found or access denied." };

  // Drop rows the user left blank (qty 0) — no movement needed for those.
  const rows = p.data.rows.filter((r) => r.qty > 0);
  if (!rows.length) return { error: "Enter a quantity for at least one product." };

  const ids = rows.map((r) => r.product_id);
  const [{ data: existing }, { data: products }] = await Promise.all([
    sb.from("stock").select("product_id, qty").eq("branch_id", p.data.branch_id).in("product_id", ids),
    sb.from("products").select("id, model, sku, brands(name)").in("id", ids),
  ]);
  const stocked = new Set((existing ?? []).filter((s) => s.qty > 0).map((s) => s.product_id));
  const clashes = rows.filter((r) => stocked.has(r.product_id));
  if (clashes.length) {
    const first = products?.find((x) => x.id === clashes[0].product_id);
    const brand = Array.isArray(first?.brands) ? first.brands[0] : first?.brands;
    const label = first ? `${brand?.name ?? ""} ${first.model}`.trim() : "a product";
    const who = clashes.length === 1 ? `1 product (${label}) already has` : `${clashes.length} products already have`;
    return { error: `${who} stock at this branch. Opening stock is only for empty products — use Stock adjustments instead.` };
  }

  const { error } = await sb.from("stock_movements").insert(
    rows.map((r) => ({ branch_id: p.data.branch_id, product_id: r.product_id, delta: r.qty, reason: "opening", note: "Opening stock" })),
  );
  if (error) return { error: error.message };

  revalidatePath("/opening-stock"); revalidatePath("/inventory");
  return { ok: `Opening stock posted for ${rows.length} product${rows.length > 1 ? "s" : ""}.` };
}
