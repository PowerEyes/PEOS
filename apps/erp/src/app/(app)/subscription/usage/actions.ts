"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Take a fresh usage snapshot for the caller's own organisation. Reads never
 * call the entitlement gate — usage stays visible when a subscription is
 * expired or suspended — and refresh_subscription_usage() re-checks the org
 * boundary in the database.
 */
export async function refreshUsage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) redirect(`/subscription/usage?e=${encodeURIComponent("No organisation linked to your account.")}`);

  const { error } = await sb.rpc("refresh_subscription_usage", { p_org: profile.org_id });
  if (error) redirect(`/subscription/usage?e=${encodeURIComponent(dbError(error.message))}`);

  revalidatePath("/subscription/usage");
}
