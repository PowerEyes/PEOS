import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OwnerDashboardPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role").eq("user_id", user.id).single();
  if (!profile || profile.role !== "owner" && profile.role !== "admin") return null;

  const tenantId = profile.tenant_id;

  const { data: branches } = await sb.from("branches").select("id, name, is_active").eq("tenant_id", tenantId);
  const { data: staff } = await sb.from("staff_profiles").select("id, role, is_active").eq("tenant_id", tenantId);
  const { data: customers } = await sb.from("customers").select("id").eq("tenant_id", tenantId);
  const { data: sales } = await sb.from("sales").select("id, total, branch_id").eq("tenant_id", tenantId);

  const totalSales = sales?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const branchCount = branches?.length || 0;
  const staffCount = staff?.length || 0;
  const customerCount = customers?.length || 0;

  // Branch performance
  const branchSales = branches?.map((b: any) => ({
    name: b.name,
    sales: sales?.filter((s: any) => s.branch_id === b.id).length || 0,
    revenue: sales?.filter((s: any) => s.branch_id === b.id).reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Company Overview</h1>
        <p className="text-sm text-slate-500">All branches, all employees, all operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm text-slate-500">Branches</p>
          <p className="text-3xl font-bold text-navy-900">{branchCount}</p>
          <p className="text-xs text-slate-400 mt-1">{branches?.filter((b: any) => b.is_active).length || 0} active</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Employees</p>
          <p className="text-3xl font-bold text-navy-900">{staffCount}</p>
          <p className="text-xs text-slate-400 mt-1">{staff?.filter((s: any) => s.is_active).length || 0} active</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Customers</p>
          <p className="text-3xl font-bold text-navy-900">{customerCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Total Sales</p>
          <p className="text-3xl font-bold text-navy-900">₹{totalSales.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{sales?.length || 0} transactions</p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-4">Branch Performance</h3>
        <div className="space-y-3">
          {branchSales.map((b: any) => (
            <div key={b.name} className="flex items-center gap-4">
              <span className="w-32 text-sm font-medium truncate">{b.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gold-500 h-full rounded-full transition-all"
                  style={{ width: `${totalSales > 0 ? (b.revenue / totalSales) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium w-24 text-right">₹{b.revenue.toLocaleString()}</span>
              <span className="text-xs text-slate-500 w-16 text-right">{b.sales} sales</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/branches" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Branches</p>
          <p className="text-sm text-slate-500">Manage all locations</p>
        </Link>
        <Link href="/staff" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Employees</p>
          <p className="text-sm text-slate-500">Manage team & permissions</p>
        </Link>
        <Link href="/subscription" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Subscription</p>
          <p className="text-sm text-slate-500">Plan & billing</p>
        </Link>
        <Link href="/settings" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Settings</p>
          <p className="text-sm text-slate-500">Company configuration</p>
        </Link>
        <Link href="/reports" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Reports</p>
          <p className="text-sm text-slate-500">Analytics & insights</p>
        </Link>
        <Link href="/finance" className="card p-4 hover:shadow-md transition-shadow text-center">
          <p className="text-lg font-semibold text-navy-900">Finance</p>
          <p className="text-sm text-slate-500">GST, ledger & accounts</p>
        </Link>
      </div>
    </div>
  );
}