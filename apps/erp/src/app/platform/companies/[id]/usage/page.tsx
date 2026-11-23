import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanyUsagePage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: company } = await sb.from("tenants").select("name").eq("id", params.id).single();
  const { data: branches } = await sb.from("branches").select("id").eq("tenant_id", params.id);
  const { data: staff } = await sb.from("staff_profiles").select("id").eq("tenant_id", params.id);
  const { data: customers } = await sb.from("customers").select("id").eq("tenant_id", params.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{company?.name} — Usage Statistics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5"><p className="text-sm text-slate-500">Branches</p><p className="text-3xl font-bold text-navy-900">{branches?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Employees</p><p className="text-3xl font-bold text-navy-900">{staff?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Customers</p><p className="text-3xl font-bold text-navy-900">{customers?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Storage</p><p className="text-3xl font-bold text-navy-900">0 MB</p></div>
      </div>
    </div>
  );
}