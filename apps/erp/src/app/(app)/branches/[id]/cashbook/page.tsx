import { supabaseServer } from "@/lib/supabase/server";

export default async function BranchCashbookPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: branch } = await sb.from("branches").select("name").eq("id", params.id).single();
  const { data: payments } = await sb.from("payments").select("id, amount, method, created_at").eq("branch_id", params.id).order("created_at", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{branch?.name} — Cashbook</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Method</th><th className="text-right p-3">Amount</th></tr></thead>
          <tbody>
            {payments?.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="p-3">{p.method}</td>
                <td className="p-3 text-right">₹{p.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!payments || payments.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No transactions yet</p>}
      </div>
    </div>
  );
}