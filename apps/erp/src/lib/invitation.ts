import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export interface InvitationData {
  tenant_id: string;
  branch_id: string;
  email: string;
  full_name: string;
  role: string;
  invited_by: string;
  additional_branches?: string[];
}

export async function createInvitation(data: InvitationData) {
  const { data: invitation, error } = await sb.from("staff_invitations").insert({
    tenant_id: data.tenant_id, branch_id: data.branch_id, email: data.email,
    full_name: data.full_name, role: data.role, invited_by: data.invited_by,
    additional_branches: data.additional_branches || [], status: "pending",
  }).select().single();

  if (error) throw error;
  return invitation;
}

export async function acceptInvitation(invitationId: string, userId: string) {
  const { data: invitation } = await sb.from("staff_invitations").select("*").eq("id", invitationId).eq("status", "pending").single();
  if (!invitation) throw new Error("Invitation not found or already used");
  if (new Date(invitation.expires_at) < new Date()) throw new Error("Invitation expired");

  // Create staff profile
  await sb.from("staff_profiles").insert({
    user_id: userId, tenant_id: invitation.tenant_id, branch_id: invitation.branch_id,
    role: invitation.role, status: "approved", full_name: invitation.full_name,
  });

  // Update invitation
  await sb.from("staff_invitations").update({ status: "accepted" }).eq("id", invitationId);

  return invitation;
}

export async function revokeInvitation(invitationId: string) {
  await sb.from("staff_invitations").update({ status: "revoked" }).eq("id", invitationId);
}

export async function getPendingInvitations(tenantId: string) {
  const { data } = await sb.from("staff_invitations").select("*").eq("tenant_id", tenantId).eq("status", "pending").order("created_at", { ascending: false });
  return data || [];
}