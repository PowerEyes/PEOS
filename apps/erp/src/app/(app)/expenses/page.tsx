import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ExpensesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: expenses } = await sb.from("expenses").select("*").eq("tenant_id", profile?.tenant_id).order("created_at", { ascending: false }).limit(50);

  const total = expenses?.reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Expenses</h1>
          <p className="text-sm text-slate-500">Expense management and tracking</p>
        </div>
        <button className="btn btn-primary">+ Add Expense</button>
      </div>
      <div className="card p-5">
        <p className="text-sm text-slate-500">Total Expenses</p>
        <p className="text-3xl font-bold text-red-600">₹{total.toLocaleString()}</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Category</th><th className="text-left p-3">Description</th><th className="text-right p-3">Amount</th></tr></thead>
          <tbody>
            {expenses?.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{new Date(e.created_at).toLocaleDateString()}</td>
                <td className="p-3">{e.category || "—"}</td>
                <td className="p-3">{e.description || "—"}</td>
                <td className="p-3 text-right">₹{e.amount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!expenses || expenses.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No expenses recorded</p>}
      </div>
    </div>
  );
}