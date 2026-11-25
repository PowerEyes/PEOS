import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ExpensesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await sb
    .from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.org_id) {
    return <div className="card p-6 text-sm text-rose-600">Your organization context could not be verified. Contact your administrator.</div>;
  }

  const { data: expenses, error } = await sb
    .from("expenses")
    .select("id, expense_date, category, description, amount, payment_method")
    .eq("org_id", profile.org_id)
    .order("expense_date", { ascending: false })
    .limit(100);

  const total = (expenses ?? []).reduce((sum: number, expense: any) => sum + Number(expense.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Expenses</h1>
          <p className="text-sm text-slate-500">Expense management and tracking</p>
        </div>
        <Link href="/finance" className="btn btn-primary">Open finance</Link>
      </div>
      {error ? <div role="alert" className="card p-5 text-sm text-rose-600">Expenses could not be loaded. {error.message}</div> : (
        <>
          <div className="card p-5">
            <p className="text-sm text-slate-500">Expenses in the latest 100 records</p>
            <p className="text-3xl font-bold text-red-600">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Category</th><th className="text-left p-3">Description</th><th className="text-left p-3">Method</th><th className="text-right p-3">Amount</th></tr></thead>
                <tbody>
                  {(expenses ?? []).map((e: any) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-3">{e.expense_date ? new Date(`${e.expense_date}T00:00:00`).toLocaleDateString("en-IN") : "—"}</td>
                      <td className="p-3">{e.category || "—"}</td>
                      <td className="p-3">{e.description || "—"}</td>
                      <td className="p-3 capitalize">{e.payment_method || "—"}</td>
                      <td className="p-3 text-right">₹{Number(e.amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!expenses || expenses.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No expenses recorded.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
