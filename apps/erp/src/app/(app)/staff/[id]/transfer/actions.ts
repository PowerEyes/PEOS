"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { subscriptionGate } from "@/lib/entitlements";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(id: string, message: string): never {
  redirect(`/staff/${id}/transfer?e=${encodeURIComponent(message)}`);
}

/**
 * Move an employee to another branch (owner/admin only). admin_update_staff()
 * re-checks the caller, the org boundary and the last-owner rule in the
 * database; this action validates the form and carries failures back on the
 * query string so the form stays a plain <form action>.
 */
export async function transferStaff(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/staff");

  const gate = await subscriptionGate();
  if (gate) fail(id, gate.error);

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) fail(id, "No organisation linked to your account.");
  if (!["owner", "admin"].includes(profile.role_key ?? "")) fail(id, "Only owners and admins can transfer staff.");

  const target = String(formData.get("target_branch") ?? "");
  if (!UUID.test(target)) fail(id, "Choose the branch to transfer to.");
  if (target === String(formData.get("current_branch") ?? "")) fail(id, "The employee already works at that branch.");

  const [{ data: staff }, { data: branch }] = await Promise.all([
    sb.from("profiles").select("id, branch_id").eq("id", id).eq("org_id", profile.org_id).maybeSingle(),
    sb.from("branches").select("id").eq("id", target).eq("org_id", profile.org_id).eq("is_active", true).maybeSingle(),
  ]);
  if (!staff) fail(id, "That employee is not part of your company.");
  if (!branch) fail(id, "That branch does not belong to your company.");

  const { error } = await sb.rpc("admin_update_staff", {
    p_id: id,
    p_role: null,
    p_branch: target,
    p_set_branch: true,
    p_deactivated: null,
  });
  if (error) fail(id, dbError(error.message));

  revalidatePath("/staff");
  redirect("/staff");
}
