import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchInventoryPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: branches } = await sb.from("branches").select("id, name").eq("tenant_id", profile?.tenant_id);
  const { data: stock } = await sb.from("inventory_ledger").select("branch_id, qty").eq("tenant_id", profile?.tenant_id);

  const branchStock = branches?.map((b: any) => ({
    name: b.name,
    items: stock?.filter((s: any) => s.branch_id === b.id).length || 0,
    totalQty: stock?.filter((s: any) => s.branch_id === b.id).reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Branch Inventory Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branchStock.map((b: any) => (
          <div key={b.name} className="card p-5">
            <h3 className="font-semibold text-navy-900">{b.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{b.items} items · {b.totalQty} units</p>
          </div>
        ))}
      </div>
    </div>
  );
}