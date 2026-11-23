import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchDashboardPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id").eq("user_id", user.id).single();
  const { data: branch } = await sb.from("branches").select("name").eq("id", profile?.branch_id).single();
  const { data: sales } = await sb.from("sales").select("id, total").eq("branch_id", profile?.branch_id);
  const { data: customers } = await sb.from("customers").select("id").eq("tenant_id", profile?.tenant_id);
  const { data: lowStock } = await sb.from("inventory_ledger").select("id").eq("branch_id", profile?.branch_id).lt("qty", 5);

  const todaySales = sales?.filter((s: any) => new Date(s.created_at).toDateString() === new Date().toDateString()).length || 0;
  const totalRevenue = sales?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{branch?.name || "Branch"} Dashboard</h1>
        <p className="text-sm text-slate-500">Today's operations overview</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5"><p className="text-sm text-slate-500">Today's Sales</p><p className="text-3xl font-bold text-navy-900">{todaySales}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Monthly Revenue</p><p className="text-3xl font-bold text-navy-900">₹{totalRevenue.toLocaleString()}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Customers</p><p className="text-3xl font-bold text-navy-900">{customers?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Low Stock Alerts</p><p className="text-3xl font-bold text-red-600">{lowStock?.length || 0}</p></div>
      </div>
    </div>
  );
}