"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { validateRx } from "@poweros/business-rules";
const n = z.number().nullable();
const eye = z.object({ sph: n, cyl: n, axis: n, add: n, va_dist: z.string(), va_near: z.string() });
const schema = z.object({
  customer_id: z.string().uuid("Choose a customer"), source: z.enum(["manual", "ocr", "external"]), image_path: z.string().nullable(),
  external_practice: z.string().trim().max(120).optional().transform(v => v || null),
  examined_by: z.string().trim().max(80), valid_till: z.string().min(8, "Choose the valid-till date"), remarks: z.string().max(300),
  values: z.object({ od: eye, os: eye, pd_far: n, pd_near: n }) });
export async function createPrescription(input: unknown): Promise<{ error?: string; ok?: string; id?: string }> {
  const p = schema.safeParse(input); if (!p.success) return { error: p.error.issues[0].message };
  const { values: v, ...rest } = p.data;
  const bad = validateRx(v).find((m) => m.startsWith("Enter at least") || m.includes("add an axis")); if (bad) return { error: bad };
  if (rest.source === "external" && !rest.image_path) return { error: "An external prescription needs a photo of the hard copy." };
  const branch = cookies().get("branch")?.value;
  const row = { customer_id: rest.customer_id, source: rest.source, image_path: rest.image_path, external_practice: rest.external_practice ?? null,
    examined_by: rest.examined_by || null,
    valid_till: rest.valid_till, remarks: rest.remarks || null, branch_id: branch || null,
    purpose: v.od.add || v.os.add ? "Distance & Near" : "Distance", pd_far: v.pd_far, pd_near: v.pd_near,
    ...Object.fromEntries((["od", "os"] as const).flatMap((s) => Object.entries(v[s]).map(([k, val]) => [`${s}_${k}`, val === "" ? null : val]))) };
  const { data, error } = await supabaseServer().from("prescriptions").insert(row).select("rx_code, id").single();
  if (error) return { error: error.message };
  revalidatePath("/prescriptions"); return { ok: data.rx_code, id: data.id };
}
