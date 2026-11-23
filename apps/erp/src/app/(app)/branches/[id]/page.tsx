import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: branch } = await sb.from("branches").select("*").eq("id", params.id).single();
  if (!branch) notFound();

  const { data: staff } = await sb.from("staff_profiles").select("*, auth_users:user_id(email)").eq("branch_id", params.id);
  const { data: sales } = await sb.from("sales").select("id, total, created_at").eq("branch_id", params.id).order("created_at", { ascending: false }).limit(5);
  const { data: inventory } = await sb.from("inventory_ledger").select("id").eq("branch_id", params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{branch.name}</h1>
          <p className="text-sm text-slate-500">{branch.address || "No address"} · {branch.code}</p>
        </div>
        <Link href={`/branches/${params.id}/edit`} className="btn btn-outline">Edit</Link>
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
          <p className="text-sm text-slate-500">Inventory Entries</p>
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
                <p className="text-sm text-slate-500">{s.role}</p>
              </div>
              <Link href={`/staff/${s.id}`} className="text-sm text-gold-600 hover:underline">View</Link>
            </div>
          ))}
          {(!staff || staff.length === 0) && <p className="text-sm text-slate-500">No staff assigned</p>}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy-900 mb-3">Recent Sales</h3>
          {sales?.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <p className="text-sm">{new Date(s.created_at).toLocaleDateString()}</p>
              <p className="font-medium">₹{s.total?.toLocaleString()}</p>
            </div>
          ))}
          {(!sales || sales.length === 0) && <p className="text-sm text-slate-500">No sales yet</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Link href={`/branches/${params.id}/inventory`} className="btn btn-outline">Inventory</Link>
        <Link href={`/branches/${params.id}/sales`} className="btn btn-outline">Sales</Link>
        <Link href={`/branches/${params.id}/reports`} className="btn btn-outline">Reports</Link>
      </div>
    </div>
  );
}