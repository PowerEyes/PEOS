import { supabaseServer } from "@/lib/supabase/server";

export default async function LabTechPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("branch_id").eq("user_id", user.id).single();
  const { data: jobs } = await sb.from("lab_orders").select("id, status, customer_name").eq("branch_id", profile?.branch_id).in("status", ["ordered", "received", "edging", "fitting", "qc"]).order("created_at");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Lab Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Assigned Jobs</p><p className="text-3xl font-bold text-navy-900">{jobs?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">In Progress</p><p className="text-3xl font-bold text-blue-600">{jobs?.filter((j: any) => ["edging", "fitting"].includes(j.status)).length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">QC Pending</p><p className="text-3xl font-bold text-amber-600">{jobs?.filter((j: any) => j.status === "qc").length || 0}</p></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">My Job Queue</h3>
        {jobs?.map((j: any) => (
          <div key={j.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div><p className="font-medium">{j.customer_name}</p><p className="text-sm text-slate-500">{j.status}</p></div>
            <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">{j.status}</span>
          </div>
        ))}
        {(!jobs || jobs.length === 0) && <p className="text-sm text-slate-500">No jobs assigned</p>}
      </div>
    </div>
  );
}