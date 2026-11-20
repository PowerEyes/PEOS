"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
export async function advanceLab(ids: string[], to: string, note?: string, supplier?: string): Promise<R> {
  const { error } = await supabaseServer().rpc("advance_lab_orders", { p_ids: ids, p_to: to, p_note: note ?? null, p_supplier: supplier ?? null });
  if (error) return { error: dbError(error.message) }; revalidatePath("/workshop"); revalidatePath("/sales"); return { ok: ids.length > 1 ? `${ids.length} lab orders updated` : "Lab order updated" };
}
export async function updateLab(id: string, v: { assigned_to: string; priority: "normal" | "urgent"; due_date: string }): Promise<R> {
  if (!["normal", "urgent"].includes(v.priority)) return { error: "Invalid priority" };
  const { error } = await supabaseServer().from("lab_orders").update({ assigned_to: v.assigned_to.trim() || null, priority: v.priority, due_date: v.due_date || null }).eq("id", id);
  if (error) return { error: dbError(error.message) }; revalidatePath("/workshop"); return { ok: "Saved" };
}
