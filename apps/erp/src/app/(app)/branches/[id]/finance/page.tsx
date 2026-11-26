import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchFinancePage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: branch } = await sb.from("branches").select("name").eq("id", params.id).single();
  const { data: sales } = await sb.from("sales").select("id, grand_total").eq("branch_id", params.id).eq("kind", "order").neq("status", "cancelled");
  const { data: expenses } = await sb.from("expenses").select("id, amount").eq("branch_id", params.id);

  const revenue = sales?.reduce((s: number, x: any) => s + (Number(x.grand_total) || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((s: number, x: any) => s + (x.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{branch?.name} — Finance</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Revenue</p><p className="text-3xl font-bold text-green-600">₹{revenue.toLocaleString()}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Expenses</p><p className="text-3xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Net Profit</p><p className="text-3xl font-bold text-navy-900">₹{(revenue - totalExpenses).toLocaleString()}</p></div>
      </div>
    </div>
  );
}