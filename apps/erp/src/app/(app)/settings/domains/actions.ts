"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
export async function addDomain(domain: string) {
  const { error } = await supabaseServer().rpc("add_org_domain", { p_domain: domain });
  if (error) return { error: dbError(error.message) }; revalidatePath("/settings/domains"); return { ok: "Domain added. Point its DNS at your storefront deployment." };
}
export async function removeDomain(domain: string) {
  const { error } = await supabaseServer().rpc("remove_org_domain", { p_domain: domain });
  if (error) return { error: dbError(error.message) }; revalidatePath("/settings/domains"); return { ok: "Domain removed." };
}
