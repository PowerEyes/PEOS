"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
export async function advanceWebOrder(id: string, status: string) {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("advance_web_order", { p_sale: id, p_status: status });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/web-orders"); return { ok: "Updated." };
}
