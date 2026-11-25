import { supabaseServer } from "@/lib/supabase/server";
import { BranchAccess } from "./branch-access";
import { StaffView } from "./view";
import { Assignments } from "./assignments";
import { Permissions } from "./permissions";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: staff }, { data: branches }] = await Promise.all([
    sb.from("profiles").select("id,full_name,role_key,is_approved,branch_id,deactivated,created_at,branch_reviewed").order("created_at",{ascending:false}),
    sb.from("branches").select("id,name").eq("is_active",true).order("name"),
  ]);
  const { data: perms } = await sb.from("role_permissions").select("role_key,permission,allowed");
  const { data: assignments } = await sb.from("staff_assignments").select("*").order("created_at", { ascending: false }).limit(50);
  const { data: links } = await sb.from("profile_branches").select("profile_id,branch_id");
  const roster = staff ?? [];
  const activeStaff = roster.filter((s: any) => !s.deactivated && s.is_approved).length;
  const pendingStaff = roster.filter((s: any) => !s.is_approved && !s.deactivated).length;
  const inactiveStaff = roster.filter((s: any) => s.deactivated).length;
  const branchCount = (branches ?? []).length;
  return (<div className="space-y-6"><ModuleKpiGrid items={[{label:"Staff records",value:roster.length,detail:"All visible staff"},{label:"Active & approved",value:activeStaff,tone:"success",detail:"Approved active accounts"},{label:"Pending approval",value:pendingStaff,tone:pendingStaff?"warning":"default",detail:"Require admin review"},{label:"Active branches",value:branchCount,detail:"Available branch locations"}]} /><StaffView staff={staff ?? []} branches={branches ?? []} /><BranchAccess staff={staff ?? []} branches={branches ?? []} links={links ?? []} /><Permissions rows={perms ?? []} /><Assignments staff={staff ?? []} branches={branches ?? []} assignments={assignments ?? []} /></div>);
}
