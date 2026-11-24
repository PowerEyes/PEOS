import { supabaseServer } from "@/lib/supabase/server";

export default async function PayrollPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: staff } = await sb.from("staff_profiles").select("id, full_name, role, salary").eq("tenant_id", profile?.tenant_id).eq("is_active", true);

  const totalSalary = staff?.reduce((s: number, e: any) => s + (e.salary || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Payroll</h1>
          <p className="text-sm text-slate-500">Salary processing and payment</p>
        </div>
        <button className="btn btn-primary">Process Payroll</button>
      </div>
      <div className="card p-5">
        <p className="text-sm text-slate-500">Total Monthly Salary</p>
        <p className="text-3xl font-bold text-navy-900">₹{totalSalary.toLocaleString()}</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Role</th><th className="text-right p-3">Salary</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {staff?.map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-medium">{s.full_name}</td>
                <td className="p-3">{s.role}</td>
                <td className="p-3 text-right">₹{s.salary?.toLocaleString() || "—"}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">Pending</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!staff || staff.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No active staff</p>}
      </div>
    </div>
  );
}