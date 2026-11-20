"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
type R = { error?: string; ok?: string; id?: string };
const schema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid("Choose a customer"),
  referred_by: z.string().trim().max(80).optional().transform(v=>v||null),
  item_brand: z.string().trim().max(80).optional().transform(v=>v||null),
  item_model: z.string().trim().max(80).optional().transform(v=>v||null),
  item_type: z.enum(["Spectacle Frame","Sunglasses","Contact Lens Pack","Accessory","Other"]),
  item_color: z.string().trim().max(40).optional().transform(v=>v||null),
  frame_no: z.string().trim().max(40).optional().transform(v=>v||null),
  problem: z.string().trim().min(3,"Describe the problem"),
  technician_notes: z.string().trim().max(500).optional().transform(v=>v||null),
  priority: z.enum(["low","medium","high","urgent"]),
  assigned_to: z.string().trim().max(80).optional().transform(v=>v||null),
  due_date: z.string().optional().transform(v=>v||null),
  repair_charges: z.number().min(0), parts_cost: z.number().min(0),
  discount: z.number().min(0), tax_pct: z.number().min(0).max(28),
  images: z.array(z.string().max(400)).max(3).optional().transform(v => v ?? []),
  photo_consent: z.boolean().default(false),
  photo_consent_at: z.string().max(40).optional().transform(v => v || null),
});
export async function saveRepair(input: unknown): Promise<R> {
  const p = schema.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const { id, photo_consent, photo_consent_at, ...rest } = p.data;
  const row = { ...rest, photo_consent, photo_consent_at: photo_consent ? (photo_consent_at ?? new Date().toISOString()) : null };
  const branch = cookies().get("branch")?.value;
  if (!branch) return { error: "Select a branch first" };
  const sb = supabaseServer();
  const { data, error } = id
    ? await sb.from("repairs").update({ ...row, branch_id: branch }).eq("id",id).select("id,code").single()
    : await sb.from("repairs").insert({ ...row, branch_id: branch }).select("id,code").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/repairs"); return { ok: data.code, id: data.id };
}
export async function advanceRepair(id: string, to: string, note?: string): Promise<R> {
  const { error } = await supabaseServer().rpc("advance_repair",{ p_id: id, p_to: to, p_note: note ?? null });
  if (error) return { error: dbError(error.message) }; revalidatePath("/repairs"); return { ok: "Status updated" };
}
