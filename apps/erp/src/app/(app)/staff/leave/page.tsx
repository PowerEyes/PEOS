import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";

export default async function LeavePage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("org_id, branch_id").eq("id", user.id).maybeSingle();
  const [{ count: staffCount }, { count: activeBranches }] = await Promise.all([
    sb.from("profiles").select("id", {count:"exact",head:true}).eq("org_id", profile?.org_id ?? "00000000-0000-0000-0000-000000000000").eq("deactivated", false),
    sb.from("branches").select("id", {count:"exact",head:true}).eq("org_id", profile?.org_id ?? "00000000-0000-0000-0000-000000000000").eq("is_active", true),
  ]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-navy-900">Leave Management</h1><p className="text-sm text-slate-500">Leave policy and request workflow status</p></div>
      <ModuleKpiGrid items={[{label:"Staff eligible for leave",value:staffCount ?? 0,detail:"Active staff records"},{label:"Active branches",value:activeBranches ?? 0,detail:"Organization locations"},{label:"Requests pending",value:"Not tracked",tone:"warning",detail:"Leave request schema/workflow not available"},{label:"Requests approved",value:"Not tracked",detail:"No canonical leave-request records"}]} />
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <h2 className="font-semibold">Leave request workflow is not implemented</h2>
        <p className="mt-1 text-sm">This page does not submit or approve leave requests yet. The previous Apply Leave button was non-functional and has been removed. No sample leave data is shown as real data.</p>
        <p className="mt-3 text-sm font-medium">Next implementation requirement: leave types, balances/accrual rules, request records, overlap validation, approval permissions, status history, and staff-facing request/withdrawal flow.</p>
      </section>
    </div>
  );
}
