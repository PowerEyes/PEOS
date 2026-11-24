import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: branch } = await sb.from("branches").select("*").eq("id", params.id).single();
  if (!branch) notFound();

  const { data: staff } = await sb.from("profiles").select("id, full_name, role_key, deactivated").eq("branch_id", params.id);
  const { data: sales } = await sb.from("sales").select("id, grand_total, created_at").eq("branch_id", params.id).eq("kind", "order").neq("status", "cancelled").order("created_at", { ascending: false }).limit(5);
  const { data: inventory } = await sb.from("stock_movements").select("id").eq("branch_id", params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{branch.name}</h1>
          <p className="text-sm text-slate-500">{branch.address || "No address"} · {branch.code}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/branches/${params.id}/performance`} className="btn btn-outline">Performance</Link>
          <Link href={`/branches/${params.id}/finance`} className="btn btn-outline">Finance</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Staff</p>
          <p className="text-2xl font-bold text-navy-900">{staff?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Recent Sales</p>
          <p className="text-2xl font-bold text-navy-900">{sales?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Stock Movements</p>
          <p className="text-2xl font-bold text-navy-900">{inventory?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Status</p>
          <p className="text-2xl font-bold text-navy-900">{branch.is_active ? "Active" : "Inactive"}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-3">Staff</h3>
          {staff?.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{s.full_name || "—"}</p>
                <p className="text-sm text-slate-500">{s.role_key}{s.deactivated ? " · inactive" : ""}</p>
              </div>
            </div>
          ))}
          {(!staff || staff.length === 0) && <p className="text-sm text-slate-500">No staff assigned</p>}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-3">Recent Sales</h3>
          {sales?.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <p className="text-sm">{new Date(s.created_at).toLocaleDateString()}</p>
              <p className="font-medium">₹{s.grand_total?.toLocaleString()}</p>
            </div>
          ))}
          {(!sales || sales.length === 0) && <p className="text-sm text-slate-500">No sales yet</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Link href={`/branches/${params.id}/performance`} className="btn btn-outline">Performance</Link>
        <Link href={`/branches/${params.id}/finance`} className="btn btn-outline">Finance</Link>
        <Link href={`/branches/${params.id}/cashbook`} className="btn btn-outline">Cashbook</Link>
        <Link href="/reports/branch-comparison" className="btn btn-outline">Compare branches</Link>
      </div>
    </div>
  );
}