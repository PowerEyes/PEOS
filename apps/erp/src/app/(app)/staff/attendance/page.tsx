import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";

// Branch roster. A real attendance table (clock in/out) is not in the schema yet,
// so this shows the data that does exist: who works here today and who is
// covering from another branch via a temporary assignment.
export default async function AttendancePage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("branch_id").eq("id", user.id).single();

  const now = new Date().toISOString();
  const branchId = profile?.branch_id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: staff }, { data: covers }] = await Promise.all([
    sb.from("profiles").select("id, full_name, role_key, is_approved, deactivated, created_at")
      .eq("branch_id", branchId).order("full_name"),
    sb.from("staff_assignments").select("profile_id, starts_at, ends_at, reason")
      .eq("branch_id", branchId).is("revoked_at", null)
      .lte("starts_at", now).gte("ends_at", now),
  ]);
  const covering = new Map((covers ?? []).map((c: any) => [c.profile_id, c]));

  const roster = staff ?? [];
  const active = roster.filter((s: any) => !s.deactivated && s.is_approved).length;
  const pending = roster.filter((s: any) => !s.is_approved && !s.deactivated).length;
  const coveringCount = covering.size;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Attendance</h1>
        <p className="text-sm text-slate-500">Staff scheduled at your branch today</p>
      </div>
      <ModuleKpiGrid items={[{label:"Branch roster",value:roster.length,detail:"Staff assigned to this branch"},{label:"Approved active",value:active,tone:"success",detail:"Active approved accounts"},{label:"Pending approval",value:pending,tone:pending?"warning":"default",detail:"Staff awaiting approval"},{label:"Temporary coverage",value:coveringCount,detail:"Active staff assignments"}]} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This page currently shows the branch roster and temporary assignments. It is not a clock-in/clock-out attendance register; actual attendance tracking is not implemented in this data model.</div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Role</th><th className="text-left p-3">Status</th><th className="text-left p-3">Covering</th><th className="text-right p-3">Joined</th></tr></thead>
          <tbody>
            {staff?.map((s: any) => {
              const cover = covering.get(s.id);
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3 capitalize">{(s.role_key || "").replace(/_/g, " ")}</td>
                  <td className="p-3">
                    {s.deactivated ? (
                      <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">Inactive</span>
                    ) : s.is_approved ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">Pending approval</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{cover ? (cover.reason || "Temporary assignment") : "—"}</td>
                  <td className="p-3 text-right text-slate-500">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!staff || staff.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No staff in this branch</p>}
      </div>
    </div>
  );
}
