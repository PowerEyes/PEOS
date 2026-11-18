
import { supabaseServer } from "@/lib/supabase/server";
const ORG = "00000000-0000-0000-0000-000000000001";

export async function awardPurchasePoints(customerId: string, saleId: string, billAmount: number) {
  const sb = supabaseServer();
  const { data: rules } = await sb.from("loyalty_rules").select("earn_rate").eq("org_id",ORG).single();
  const earnRate = rules?.earn_rate ?? 10;
  const delta    = Math.floor(billAmount / 100 * earnRate);
  if (delta <= 0) return;
  await sb.from("loyalty_ledger").insert({
    org_id: ORG, customer_id: customerId, delta,
    reason: "purchase", ref_id: saleId,
    staff_note: `Purchase ₹${billAmount} — earned ${delta} pts`,
  });
}

export async function redeemPoints(customerId: string, saleId: string, points: number, discountAmount: number) {
  if (points <= 0) return;
  const sb = supabaseServer();
  await sb.from("loyalty_ledger").insert({
    org_id: ORG, customer_id: customerId, delta: -points,
    reason: "redemption", ref_id: saleId,
    staff_note: `Redeemed ${points} pts for ₹${discountAmount} discount`,
  });
}

export async function getPointsBalance(customerId: string): Promise<number> {
  const { data } = await supabaseBrowser().from("loyalty_ledger")
    .select("delta").eq("customer_id", customerId);
  return Math.max(0, (data ?? []).reduce((a:number, r:any) => a + Number(r.delta), 0));
}

function supabaseBrowser() { return supabaseServer(); }
