import { supabaseServer } from "@/lib/supabase/server";

export default async function BankReconciliationPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Bank Reconciliation</h1>
      <p className="text-sm text-slate-500">Bank matching and reconciliation</p>
      <div className="card p-6 text-center text-slate-500">
        <p>Upload bank statement to begin reconciliation</p>
        <button className="btn btn-primary mt-4">Upload Statement</button>
      </div>
    </div>
  );
}