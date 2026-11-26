import { supabaseServer } from "@/lib/supabase/server";

export default async function BackupSettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Backup & Recovery</h1>
      <p className="text-sm text-slate-500">Backup and recovery settings</p>
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Automated Backups</p><p className="text-sm text-slate-500">Daily backups via Supabase</p></div>
          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Enabled</span>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Last Backup</p><p className="text-sm text-slate-500">Today, 3:00 AM</p></div>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Retention</p><p className="text-sm text-slate-500">30 days</p></div>
        </div>
        <button className="btn btn-primary">Export Data Now</button>
      </div>
    </div>
  );
}