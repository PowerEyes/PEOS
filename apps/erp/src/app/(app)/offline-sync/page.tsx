import { supabaseServer } from "@/lib/supabase/server";

export default async function OfflineSyncPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Offline Sync</h1>
      <p className="text-sm text-slate-500">Offline transaction synchronisation</p>
      <div className="card p-6 text-center text-slate-500">
        <p>No pending offline transactions</p>
        <p className="text-sm mt-1">All data is synced</p>
      </div>
    </div>
  );
}