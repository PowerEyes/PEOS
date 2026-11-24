import { supabaseServer } from "@/lib/supabase/server";

export default async function QualityControlPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("branch_id").eq("user_id", user.id).single();
  const { data: jobs } = await sb.from("lab_orders").select("id, customer_name, status").eq("branch_id", profile?.branch_id).eq("status", "qc").order("created_at");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Quality Control</h1>
      <p className="text-sm text-slate-500">Final product inspection</p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Job</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr></thead>
          <tbody>
            {jobs?.map((j: any) => (
              <tr key={j.id} className="border-t">
                <td className="p-3 font-medium">{j.id?.slice(0, 8)}</td>
                <td className="p-3">{j.customer_name}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-700">{j.status}</span></td>
                <td className="p-3 flex gap-2">
                  <button className="btn btn-primary text-xs">Pass</button>
                  <button className="btn btn-outline text-xs">Fail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!jobs || jobs.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No jobs pending QC</p>}
      </div>
    </div>
  );
}