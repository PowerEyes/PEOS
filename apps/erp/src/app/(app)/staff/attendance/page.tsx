import { supabaseServer } from "@/lib/supabase/server";

export default async function AttendancePage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id").eq("user_id", user.id).single();
  const { data: staff } = await sb.from("staff_profiles").select("id, full_name, role").eq("branch_id", profile?.branch_id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Attendance</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Role</th><th className="text-left p-3">Status</th><th className="text-left p-3">Check-in</th><th className="text-left p-3">Check-out</th></tr></thead>
          <tbody>
            {staff?.map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-medium">{s.full_name}</td>
                <td className="p-3">{s.role}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Present</span></td>
                <td className="p-3">09:00 AM</td>
                <td className="p-3">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!staff || staff.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No staff in this branch</p>}
      </div>
    </div>
  );
}