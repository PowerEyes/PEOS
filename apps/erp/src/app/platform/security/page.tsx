import { supabaseServer } from "@/lib/supabase/server";
import { EnforcementCard } from "./enforcement-card";

export default async function PlatformSecurityPage() {
  const sb = supabaseServer();
  const [{ data: modeRow }, { data: logs }] = await Promise.all([
    sb.from("platform_settings").select("value").eq("key", "entitlement_enforcement").maybeSingle(),
    sb.from("platform_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const mode = typeof modeRow?.value === "string" ? modeRow.value : "log";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Platform Security</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Failed Logins (24h)</p><p className="text-3xl font-bold text-red-600">0</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Active Sessions</p><p className="text-3xl font-bold text-navy-900">0</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Security Events</p><p className="text-3xl font-bold text-amber-600">{logs?.length || 0}</p></div>
      </div>

      <EnforcementCard mode={mode} />

      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Recent Security Events</h3>
        {(!logs || logs.length === 0) && <p className="text-sm text-slate-500">No security events recorded</p>}
        {!!logs?.length && (
          <ul className="divide-y divide-slate-800 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-300">{l.action}</span>
                <span className="text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
