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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform administration</h2>
        <p className="text-sm text-slate-400">Platform users, roles and audit trail.</p>
      </div>
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
