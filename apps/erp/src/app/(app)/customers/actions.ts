"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
const opt = z.string().trim().optional().transform((v) => (v ? v : null));
const schema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name"),
  phone: z.string().trim().min(8, "Enter a valid contact number"),
  whatsapp: opt, email: z.string().trim().email("Enter a valid email").or(z.literal("")).transform((v) => v || null),
  referred_by_doctor: opt, gender: z.enum(["male", "female"]), dob: opt,
  address_line1: opt, address_line2: opt, landmark: opt,
  city: z.string().trim().min(1, "Enter the city"), state: z.string().trim().min(1, "Enter the state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"), notes: z.string().max(500).optional().transform((v) => v || null),
});
export type FormState = { error?: string; ok?: string; id?: string; vision_id?: string };
export async function createCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = (parsed.data.phone || "").replace(/\D/g, "");
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: profile } = await supabaseServer().from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = profile?.org_id;
  // Duplicate-mobile guard (CRM-001): warn + refuse rather than silently creating a second customer.
  if (orgId) {
    // Duplicate guard by phone OR email.
    let dupQuery = supabaseServer().from("customers").select("id, customer_code, full_name, phone, email").eq("org_id", orgId);
    const email = (parsed.data.email || "").trim();
    if (email && phone) dupQuery = dupQuery.or(`phone.eq.${phone},email.eq.${email}`);
    else if (email) dupQuery = dupQuery.eq("email", email);
    else dupQuery = dupQuery.eq("phone", phone);
    const { data: dup } = await dupQuery.limit(1);
    if (dup && dup.length > 0) return { error: `A customer already exists (${dup[0].customer_code} - ${dup[0].full_name}). Open the existing record instead of creating a duplicate.` };
  }
  const { data, error } = await supabaseServer().from("customers").insert(parsed.data).select("id, customer_code, vision_id").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/customers");
  return { ok: `Customer ${data.customer_code} saved`, id: data.id, vision_id: data.vision_id };
}

const editSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the full name"),
  phone: z.string().trim().min(8, "Enter a valid contact number"),
  whatsapp: z.string().trim().optional().transform(v => v || null),
  email: z.string().trim().email().or(z.literal("")).transform(v => v || null),
  referred_by_doctor: z.string().trim().optional().transform(v => v || null),
  gender: z.enum(["male","female"]),
  dob: z.string().optional().transform(v => v || null),
  address_line1: z.string().trim().optional().transform(v => v || null),
  address_line2: z.string().trim().optional().transform(v => v || null),
  landmark: z.string().trim().optional().transform(v => v || null),
  city: z.string().trim().min(1), state: z.string().trim().min(1),
  pincode: z.string().trim().regex(/^\d{6}$/, "6-digit pincode"),
  notes: z.string().max(500).optional().transform(v => v || null),
  tags: z.array(z.string()).optional().transform(v => v || []),
  whatsapp_opt_in: z.string().optional().transform(v => v === "on" || v === "true"),
});
export async function updateCustomer(id: string, fd: FormData): Promise<FormState> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const parsed = editSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { whatsapp_opt_in, ...rest } = parsed.data as any;
  const patch: any = { ...rest };
  if (whatsapp_opt_in !== undefined) {
    patch.whatsapp_opt_in = whatsapp_opt_in;
    patch.whatsapp_opt_in_at = whatsapp_opt_in ? new Date().toISOString() : null;
  }
  const { error } = await supabaseServer().from("customers").update(patch).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/customers");
  return { ok: "Customer updated" };
}
