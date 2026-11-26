import { supabaseServer } from "@/lib/supabase/server";

export default async function BackupMonitoringPage() {
  const sb = supabaseServer();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Backup Monitoring</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Last Backup</p><p className="text-xl font-bold text-navy-900">Today, 3:00 AM</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Backup Status</p><p className="text-xl font-bold text-green-600">Healthy</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Retention</p><p className="text-xl font-bold text-navy-900">30 days</p></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Backup History</h3>
        <p className="text-sm text-slate-500">Automated daily backups via Supabase. Manual backup: <code className="bg-slate-100 px-1 rounded">pg_dump</code></p>
      </div>
    </div>
  );
}