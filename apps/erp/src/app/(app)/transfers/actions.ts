"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
const done = (error: any, ok: string): R => { if (error) return { error: dbError(error.message) }; revalidatePath("/transfers"); return { ok }; };
export async function requestTransfer(from: string, to: string, product: string, qty: number, note?: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  return done((await supabaseServer().rpc("request_transfer", { p_from: from, p_to: to, p_product: product, p_qty: qty, p_note: note ?? null })).error, "Transfer requested.");
}
export async function approveTransfer(id: string): Promise<R> { const gate = await subscriptionGate(); if (gate) return gate; return done((await supabaseServer().rpc("approve_transfer", { p_id: id })).error, "Approved — stock deducted and in transit."); }
export async function receiveTransfer(id: string): Promise<R> { const gate = await subscriptionGate(); if (gate) return gate; return done((await supabaseServer().rpc("receive_transfer", { p_id: id })).error, "Received into stock."); }
export async function closeTransfer(id: string): Promise<R> { const gate = await subscriptionGate(); if (gate) return gate; return done((await supabaseServer().rpc("close_transfer", { p_id: id })).error, "Transfer closed."); }
