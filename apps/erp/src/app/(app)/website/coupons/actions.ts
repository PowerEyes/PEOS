
"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
import { z } from "zod";


const Schema = z.object({
  code:        z.string().min(3).max(20).toUpperCase().trim(),
  description: z.string().optional(),
  type:        z.enum(["percent","fixed"]),
  value:       z.coerce.number().min(0.01),
  min_order:   z.coerce.number().min(0).default(0),
  max_uses:    z.coerce.number().int().min(1).nullable().optional(),
  per_customer:z.coerce.number().int().min(1).default(1),
  valid_from:  z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  applicable_to: z.array(z.string()).default([]),
  is_active:   z.coerce.boolean().default(true),
});

export async function upsertCoupon(prev: any, fd: FormData) {
  const sb = supabaseServer();
  const id = fd.get("id")?.toString() ?? "";
  const raw = {
    code:         fd.get("code"), description: fd.get("description"),
    type:         fd.get("type"), value:       fd.get("value"),
    min_order:    fd.get("min_order"), max_uses: fd.get("max_uses") || null,
    per_customer: fd.get("per_customer") || "1",
    valid_from:   fd.get("valid_from") || null,
    valid_until:  fd.get("valid_until") || null,
    is_active:    fd.get("is_active") === "true",
    applicable_to:[],
  };
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const payload = { ...parsed.data };

  if (id) {
    const { error } = await sb.from("coupons").update(payload).eq("id", id);
    if (error) return { error: dbError(error.message) };
  } else {
    const { error } = await sb.from("coupons").insert(payload);
    if (error) return { error: dbError(error.message) };
  }
  revalidatePath("/website/coupons");
  return { ok: true };
}

export async function toggleCoupon(id: string, active: boolean) {
  await supabaseServer().from("coupons").update({ is_active: active }).eq("id", id);
  revalidatePath("/website/coupons");
}

export async function deleteCoupon(id: string) {
  const sb = supabaseServer();
  const { count } = await sb.from("coupon_uses").select("id",{count:"exact",head:true}).eq("coupon_id",id);
  if ((count ?? 0) > 0) return { error: "Cannot delete a coupon that has already been used. Deactivate it instead." };
  await sb.from("coupons").delete().eq("id", id);
  revalidatePath("/website/coupons");
  return { ok: true };
}
