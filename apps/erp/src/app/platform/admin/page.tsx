import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { PlatformUsersPanel } from "./users-panel";

export const dynamic = "force-dynamic";

export default async function PlatformAdmin() {
  const pu = await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: users }, { data: logs }] = await Promise.all([
    admin.from("platform_users").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("platform_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const platformUserCount = (users ?? []).length;
  const auditCount = (logs ?? []).length;
  const superAdmins = (users ?? []).filter((u: any) => u.platform_role === "super_admin").length;
  const activeUsers = (users ?? []).filter((u: any) => u.is_active !== false).length;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform administration</h2>
        <p className="text-sm text-slate-400">Platform users, roles and audit trail.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"Platform users",value:platformUserCount},{label:"Active",value:activeUsers},{label:"Super admins",value:superAdmins},{label:"Audit events loaded",value:auditCount}].map(k=><div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><p className="text-xs text-slate-400">{k.label}</p><p className="mt-1 text-xl font-semibold">{k.value}</p></div>)}</div>
      <PlatformUsersPanel users={users ?? []} canManage={pu.platform_role === "super_admin"} />
      <div className="rounded-xl border border-slate-800 p-4">
        <p className="mb-2 text-sm font-semibold">Audit log</p>
        <ul className="space-y-1 text-xs text-slate-400">
          {(logs ?? []).map((l: any) => (
            <li key={l.id}><span className="text-slate-300">{l.action}</span>{l.target_type ? ` · ${l.target_type}` : ""} · {new Date(l.created_at).toLocaleString()}</li>
          ))}
          {!(logs ?? []).length && <li className="text-slate-500">No audit entries.</li>}
        </ul>
      </div>
    </div>
  );
}
