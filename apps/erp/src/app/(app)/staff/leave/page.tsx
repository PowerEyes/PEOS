import { supabaseServer } from "@/lib/supabase/server";

export default async function LeavePage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Leave Management</h1>
        <button className="btn btn-primary">+ Apply Leave</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Employee</th><th className="text-left p-3">Type</th><th className="text-left p-3">From</th><th className="text-left p-3">To</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            <tr><td colSpan={5} className="p-6 text-center text-slate-500">No leave requests</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}