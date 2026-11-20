"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string; id?: string };
const done = () => { revalidatePath("/sales"); revalidatePath("/inventory"); };
export async function placeSale(payload: unknown): Promise<R> {
  const { rx_consent, ...p } = (payload ?? {}) as Record<string, any>;
  const { data, error } = await supabaseServer().rpc("place_sale", { p }); if (error) return { error: dbError(error.message) };
  // Hard-copy consent is recorded after the sale exists (the RPC is not rewritten).
  if (rx_consent === true) {
    await supabaseServer().from("sales")
      .update({ rx_consent: true, rx_consent_at: new Date().toISOString() })
      .eq("id", data.id).eq("rx_consent", false);
  }
  done(); return { ok: data.code, id: data.id };
}
export async function addPayment(i: { sale_id: string; amount: number; method: string; reference?: string }): Promise<R> {
  if (!(i.amount > 0)) return { error: "Enter an amount above zero." };
  if (!["cash", "upi", "card", "bank", "razorpay"].includes(i.method)) return { error: "Choose a payment method." };
  const { error } = await supabaseServer().from("payments").insert({ sale_id: i.sale_id, amount: i.amount, method: i.method, reference: i.reference || null });
  if (error) return { error: dbError(error.message) }; done(); return { ok: "Payment added" };
}
export async function cancelOrder(id: string): Promise<R> { const { error } = await supabaseServer().rpc("cancel_order", { p_id: id }); if (error) return { error: dbError(error.message) }; done(); return { ok: "Order cancelled and stock returned" }; }
export async function deliverOrder(id: string): Promise<R> { const { error } = await supabaseServer().rpc("deliver_order", { p_id: id }); if (error) return { error: dbError(error.message) }; done(); return { ok: "Marked as delivered" }; }
export async function markSent(id: string): Promise<R> { await supabaseServer().from("sales").update({ status: "sent" }).eq("id", id).eq("status", "draft"); done(); return { ok: "sent" }; }
