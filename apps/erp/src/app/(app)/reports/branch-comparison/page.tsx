import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchComparisonReportPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: branches } = await sb.from("branches").select("id, name").eq("tenant_id", profile?.tenant_id);
  const { data: sales } = await sb.from("sales").select("branch_id, total").eq("tenant_id", profile?.tenant_id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Branch Comparison Report</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left p-3">Branch</th><th className="text-right p-3">Sales</th><th className="text-right p-3">Revenue</th><th className="text-right p-3">Avg Sale</th></tr>
          </thead>
          <tbody>
            {branches?.map((b: any) => {
              const bs = sales?.filter((s: any) => s.branch_id === b.id) || [];
              const rev = bs.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
              return (
                <tr key={b.id} className="border-t">
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3 text-right">{bs.length}</td>
                  <td className="p-3 text-right">₹{rev.toLocaleString()}</td>
                  <td className="p-3 text-right">₹{bs.length > 0 ? Math.round(rev / bs.length).toLocaleString() : 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}