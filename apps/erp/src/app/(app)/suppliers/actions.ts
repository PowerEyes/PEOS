"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
export type SupplierInput = { name: string; contact_person?: string; phone?: string; email?: string; gstin?: string; address?: string; state?: string };
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function clean(v: SupplierInput): { error: string } | { row: Record<string, string | null> } {
  const name = v.name?.trim(); if (!name || name.length < 2) return { error: "Enter the supplier name." };
  const gstin = v.gstin?.trim().toUpperCase() || null; if (gstin && !GSTIN.test(gstin)) return { error: "GSTIN is not valid." };
  const email = v.email?.trim() || null; if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email is not valid." };
  const phone = v.phone?.replace(/\s/g, "") || null; if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) return { error: "Phone must be 8–15 digits." };
  return { row: { name, contact_person: v.contact_person?.trim() || null, phone, email, gstin, address: v.address?.trim() || null, state: v.state?.trim() || null } };
}
// RLS (org-scoped; writes limited to staff allowed to edit the catalogue) is the real gate; validation + revalidation here.
export async function saveSupplier(id: string | null, v: SupplierInput): Promise<R> {
  const c = clean(v); if ("error" in c) return c;
  const sb = supabaseServer();
  const { error } = id ? await sb.from("suppliers").update(c.row).eq("id", id) : await sb.from("suppliers").insert({ ...c.row, status: "active" });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/suppliers"); return { ok: id ? "Supplier updated." : "Supplier added." };
}
export async function setSupplierStatus(id: string, status: "active" | "inactive"): Promise<R> {
  const { error } = await supabaseServer().from("suppliers").update({ status }).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/suppliers"); return { ok: "Updated." };
}
export async function deleteSupplier(id: string): Promise<R> {
  const { error } = await supabaseServer().from("suppliers").delete().eq("id", id);
  if (error) return { error: /foreign key|violates/i.test(error.message) ? "This supplier is used by purchases. Mark it inactive instead." : dbError(error.message) };
  revalidatePath("/suppliers"); return { ok: "Deleted." };
}
