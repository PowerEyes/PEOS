import { supabaseServer } from "@/lib/supabase/server";
import { BranchAccess } from "./branch-access";
import { StaffView } from "./view";
import { Assignments } from "./assignments";
import { Permissions } from "./permissions";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: staff }, { data: branches }] = await Promise.all([
    sb.from("profiles").select("id,full_name,role_key,is_approved,branch_id,deactivated,created_at,branch_reviewed").order("created_at",{ascending:false}),
    sb.from("branches").select("id,name").eq("is_active",true).order("name"),
  ]);
  const { data: perms } = await sb.from("role_permissions").select("role_key,permission,allowed");
  const { data: assignments } = await sb.from("staff_assignments").select("*").order("created_at", { ascending: false }).limit(50);
  const { data: links } = await sb.from("profile_branches").select("profile_id,branch_id");
  return (<div className="space-y-6"><StaffView staff={staff ?? []} branches={branches ?? []} /><BranchAccess staff={staff ?? []} branches={branches ?? []} links={links ?? []} /><Permissions rows={perms ?? []} /><Assignments staff={staff ?? []} branches={branches ?? []} assignments={assignments ?? []} /></div>);
}
