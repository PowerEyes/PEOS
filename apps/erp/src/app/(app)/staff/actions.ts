"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { dbError } from "@poweros/business-rules";
import { GRANTABLE_ROLES } from "@/lib/rbac";
import { supabaseServer } from "@/lib/supabase/server";
import { serviceClient, linkBase } from "@/lib/doclinks";
import { assertSubscriptionWritable, subscriptionGate  } from "@/lib/entitlements";
type R = { error?: string; ok?: string };

// Every mutation is a SECURITY DEFINER RPC that re-checks the caller's role, org and branch in the database.
export async function approveStaff(id: string, role: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("admin_update_staff", { p_id: id, p_role: role, p_deactivated: false });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: `Access restored as ${role}.` };
}

export async function updateStaff(id: string, patch: { role_key?: string; branch_id?: string | null; deactivated?: boolean; is_approved?: boolean }): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("admin_update_staff", {
    p_id: id, p_role: patch.role_key ?? null, p_branch: patch.branch_id ?? null,
    p_set_branch: "branch_id" in patch, p_deactivated: patch.deactivated ?? null });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Updated successfully." };
}

export async function inviteByEmail(email: string, role: string, branchId?: string | null): Promise<R> {
  const blocked = await assertSubscriptionWritable();
  if (blocked) return { error: blocked };
  const sb = supabaseServer();
  const { data: inv, error } = await sb.rpc("invite_staff", { p_email: email, p_role: role, p_branch: branchId ?? null });
  if (error) return { error: dbError(error.message) };
  try {
    const { error: mail } = await serviceClient().auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      data: { is_staff: "true", invitation_id: inv }, redirectTo: `${linkBase(headers())}/` });
    // Existing auth users cannot be re-invited by email: the invitation stays open and is claimed at their next sign-in.
    if (mail && !/already|registered|exists/i.test(mail.message)) return { error: "Invitation saved but the email could not be sent. Ask them to sign up with that address." };
  } catch { return { error: "Invitation saved but email delivery is not configured (SUPABASE_SERVICE_ROLE_KEY)." }; }
  revalidatePath("/staff"); return { ok: `Invitation sent to ${email}. Access is granted when they confirm their email.` };
}

export async function revokeInvitation(id: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("revoke_invitation", { p_id: id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Invitation revoked." };
}

export async function assignTempBranch(profileId: string, branchId: string, endsAt: string, reason: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("assign_temp_branch", { p_profile: profileId, p_branch: branchId, p_ends: new Date(endsAt).toISOString(), p_reason: reason });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Temporary access granted." };
}
export async function revokeTempAssignment(id: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("revoke_temp_assignment", { p_id: id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Temporary access revoked." };
}

export async function setRolePermission(role: string, perm: string, allowed: boolean): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  // Mirrors GRANTABLE_ROLES in lib/rbac.ts and the role_permissions CHECK.
  const allowedRoles = [...GRANTABLE_ROLES];
  const allowedPermissions = ["finance_view", "expenses", "day_closing", "catalogue_edit", "reports_view", "crm_manage", "discount_override", "stock_adjust", "purchases_manage", "stock_audit", "transfers_approve", "web_orders", "credit_notes.issue"];
  if (!allowedRoles.includes(role) || !allowedPermissions.includes(perm) || typeof allowed !== "boolean") return { error: "Invalid role permission." };
  const { error } = await supabaseServer().rpc("set_role_permission", { p_role: role, p_permission: perm, p_allowed: allowed });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Permission updated." };
}

/** Permanently give a staff member write access to extra branches (home branch is separate). Owner/admin only, enforced in the database. */
export async function setProfileBranches(profileId: string, branchIds: string[]): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const { error } = await supabaseServer().rpc("set_profile_branches", { p_profile: profileId, p_branches: branchIds });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff"); return { ok: "Branch access updated." };
}
