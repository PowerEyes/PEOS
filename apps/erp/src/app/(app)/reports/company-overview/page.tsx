import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanyOverviewReportPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return null;
  const { data: branches } = await sb.from("branches").select("id, name, is_active").eq("org_id", profile.org_id);
  const { data: staff } = await sb.from("profiles").select("id, role_key").eq("org_id", profile.org_id);
  const { data: customers } = await sb.from("customers").select("id").eq("org_id", profile.org_id);
  const { data: sales } = await sb.from("sales").select("id, total").eq("org_id", profile.org_id);

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