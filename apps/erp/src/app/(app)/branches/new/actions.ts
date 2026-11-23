"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { subscriptionGate } from "@/lib/entitlements";

function fail(message: string): never {
  redirect(`/branches/new?e=${encodeURIComponent(message)}`);
}

/**
 * Create a branch for the caller's organisation (owner/admin only). The branch
 * limit and the org boundary are enforced again in the database, so this stays
 * a thin, honest form action: every failure is carried back on the query string,
 * which keeps the action's return type `Promise<void>` for <form action>.
 */
export async function createBranch(formData: FormData) {
  const gate = await subscriptionGate();
  if (gate) fail(gate.error);

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) fail("No organisation linked to your account.");
  if (!["owner", "admin"].includes(profile.role_key ?? "")) fail("Only owners and admins can create branches.");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase();

  if (name.length < 2) fail("Branch name is required.");
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) fail("Branch code must be 2–12 letters, numbers, dashes or underscores.");
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) fail("Enter a valid 15-character branch GSTIN.");

  const { data: inserted, error } = await sb
    .from("branches")
    .insert({
      org_id: profile.org_id,
      code,
      name,
      address: address || null,
      phone: phone || null,
      gstin: gstin || null,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !inserted?.id) fail(dbError(error?.message ?? "Could not create the branch."));

  // The first branch becomes the default pickup point, mirroring addBranch().
  const { data: hasDefault } = await sb.from("branches").select("id").eq("is_default_pickup", true).maybeSingle();
  if (!hasDefault) {
    const { error: e } = await sb.rpc("set_default_pickup_branch", { p_branch: inserted.id });
    if (e) fail(dbError(e.message));
  }

  revalidatePath("/branches");
  revalidatePath("/settings");
  redirect("/branches");
}
