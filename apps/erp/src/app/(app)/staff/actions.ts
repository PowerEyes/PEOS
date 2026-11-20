"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };

async function caller() {
  const sb = supabaseServer();
  const { data:{ user }, error } = await sb.auth.getUser();
  if (error || !user) return { sb, profile: null as any, orgId: null as string|null };
  const { data: profile } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).single();
  return { sb, profile, orgId: profile?.org_id ?? null };
}

export async function approveStaff(id: string, role: string): Promise<R> {
  const { sb, profile, orgId } = await caller();
  if (!["owner","admin"].includes(profile?.role_key ?? ""))
    return { error: "Only owners and admins can approve staff." };
  if (!orgId) return { error: "Your account is not linked to an organisation." };
  const { error } = await sb.from("profiles")
    .update({ is_approved: true, role_key: role, org_id: orgId, deactivated: false })
    .eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff");
  return { ok: `Staff approved as ${role}.` };
}

export async function updateStaff(id: string, patch: {
  role_key?: string; branch_id?: string | null;
  deactivated?: boolean; is_approved?: boolean;
}): Promise<R> {
  const { sb, profile } = await caller();
  if (!["owner","admin"].includes(profile?.role_key ?? ""))
    return { error: "Only owners and admins can edit staff." };
  if (patch.deactivated === true)  patch.is_approved = false;
  if (patch.deactivated === false) patch.is_approved = true;
  const { error } = await sb.from("profiles").update(patch).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff");
  return { ok: "Updated successfully." };
}

export async function inviteByEmail(_email: string, _role: string): Promise<R> {
  const { profile } = await caller();
  if (!["owner","admin"].includes(profile?.role_key ?? ""))
    return { error: "Only owners and admins can invite staff." };
  return { ok: `Share the PowerOS URL with ${_email}. Once they sign up they appear here as Pending for approval.` };
}
