import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchComparisonPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: branches } = await sb.from("branches").select("id, name").eq("tenant_id", profile?.tenant_id);
  const { data: sales } = await sb.from("sales").select("branch_id, total").eq("tenant_id", profile?.tenant_id);

  const comparison = branches?.map((b: any) => ({
    name: b.name,
    sales: sales?.filter((s: any) => s.branch_id === b.id).length || 0,
    revenue: sales?.filter((s: any) => s.branch_id === b.id).reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Branch Sales Comparison</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium">Branch</th>
              <th className="text-right p-3 font-medium">Sales Count</th>
              <th className="text-right p-3 font-medium">Revenue</th>
              <th className="text-right p-3 font-medium">Avg. Sale</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((b: any) => (
              <tr key={b.name} className="border-t">
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3 text-right">{b.sales}</td>
                <td className="p-3 text-right">₹{b.revenue.toLocaleString()}</td>
                <td className="p-3 text-right">₹{b.sales > 0 ? Math.round(b.revenue / b.sales).toLocaleString() : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}