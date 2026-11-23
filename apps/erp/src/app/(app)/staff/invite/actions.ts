"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function inviteStaff(formData: FormData) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role").eq("user_id", user.id).single();
  if (profile?.role !== "owner" && profile?.role !== "admin") {
    redirect("/staff?e=Permission+denied");
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const branchId = formData.get("branch_id") as string;

  const { error } = await sb.from("staff_invitations").insert({
    tenant_id: profile.tenant_id, branch_id: branchId, email, full_name: name, role,
    invited_by: user.id, status: "pending",
  });

  if (error) {
    redirect(`/staff/invite?e=${encodeURIComponent(error.message)}`);
  }

  redirect("/staff?msg=Invitation+sent");
}