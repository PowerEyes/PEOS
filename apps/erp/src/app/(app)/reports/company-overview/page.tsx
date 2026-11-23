import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanyOverviewReportPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: branches } = await sb.from("branches").select("id, name, is_active").eq("tenant_id", profile?.tenant_id);
  const { data: staff } = await sb.from("staff_profiles").select("id, role").eq("tenant_id", profile?.tenant_id);
  const { data: customers } = await sb.from("customers").select("id").eq("tenant_id", profile?.tenant_id);
  const { data: sales } = await sb.from("sales").select("id, total").eq("tenant_id", profile?.tenant_id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Company Overview Report</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5"><p className="text-sm text-slate-500">Branches</p><p className="text-3xl font-bold text-navy-900">{branches?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Employees</p><p className="text-3xl font-bold text-navy-900">{staff?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Customers</p><p className="text-3xl font-bold text-navy-900">{customers?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Total Revenue</p><p className="text-3xl font-bold text-navy-900">₹{sales?.reduce((s: number, x: any) => s + (x.total || 0), 0).toLocaleString()}</p></div>
      </div>
    </div>
  );
}