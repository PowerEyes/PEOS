import { supabaseServer } from "@/lib/supabase/server";

export default async function SecuritySettingsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Security Settings</h1>
      <p className="text-sm text-slate-500">Session and MFA management</p>
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Two-Factor Authentication</p><p className="text-sm text-slate-500">Add an extra layer of security</p></div>
          <button className="btn btn-outline">Enable 2FA</button>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Session Management</p><p className="text-sm text-slate-500">Active sessions and logout</p></div>
          <button className="btn btn-outline">View Sessions</button>
        </div>
        <div className="flex items-center justify-between">
          <div><p className="font-medium">Password Policy</p><p className="text-sm text-slate-500">Minimum 8 characters, 1 uppercase, 1 number</p></div>
        </div>
      </div>
    </div>
  );
}