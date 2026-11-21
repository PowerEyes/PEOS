"use server";
import { redirect } from "next/navigation";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
export async function createOrganisation(fd: FormData) {
  const { error } = await supabaseServer().rpc("create_organisation", { p_name: String(fd.get("org") ?? ""), p_branch_name: String(fd.get("branch") ?? ""), p_branch_code: String(fd.get("code") ?? "") });
  if (error) redirect(`/onboarding?e=${encodeURIComponent(dbError(error.message))}`);
  redirect("/");
}
