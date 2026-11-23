import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CashierPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("branch_id").eq("user_id", user.id).single();
  const { data: sales } = await sb.from("sales").select("id, total, created_at").eq("branch_id", profile?.branch_id).order("created_at", { ascending: false }).limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Cashier Dashboard</h1>
        <Link href="/sales?new=1" className="btn btn-primary">Open POS</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Today's Transactions</p><p className="text-3xl font-bold text-navy-900">{sales?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Today's Collection</p><p className="text-3xl font-bold text-navy-900">₹{sales?.reduce((s: number, x: any) => s + (x.total || 0), 0).toLocaleString()}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Pending Payments</p><p className="text-3xl font-bold text-red-600">0</p></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Recent Transactions</h3>
        {sales?.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <p className="text-sm">{new Date(s.created_at).toLocaleTimeString()}</p>
            <p className="font-medium">₹{s.total?.toLocaleString()}</p>
          </div>
        ))}
        {(!sales || sales.length === 0) && <p className="text-sm text-slate-500">No transactions yet</p>}
      </div>
    </div>
  );
}