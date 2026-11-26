"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
export async function saveLoyaltyRules(v: { earn_rate: number; redeem_rate: number; min_redeem: number; max_redeem_pct: number }): Promise<R> {
  const n = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
  if (!n(v.earn_rate, 0, 100) || !n(v.redeem_rate, 0, 100) || !n(v.min_redeem, 0, 1e6) || !n(v.max_redeem_pct, 0, 100)) return { error: "Check the values: rates 0–100, minimum points ≥ 0, maximum redemption 0–100%." };
  const sb = supabaseServer();
  const { data: o } = await sb.rpc("current_org");
  if (!o) return { error: "Not signed in." };
  const { error } = await sb.from("loyalty_rules").upsert({ org_id: o, ...v, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/loyalty"); return { ok: "Loyalty rules saved." };
}
