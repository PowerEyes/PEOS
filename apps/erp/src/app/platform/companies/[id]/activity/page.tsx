import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export default async function CompanyActivityPage({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: org }, { data: logs }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", params.id).maybeSingle(),
    admin.from("audit_log").select("id, at, action, table_name, user_id, row_id")
      .eq("org_id", params.id).order("at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{org?.name ?? "Company"} — Activity Logs</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Time</th><th className="text-left p-3">Action</th><th className="text-left p-3">Table</th><th className="text-left p-3">Actor</th></tr></thead>
          <tbody>
            {logs?.map((l: any) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-xs">{l.at ? new Date(l.at).toLocaleString() : "—"}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3 text-slate-500">{l.table_name || "—"}</td>
                <td className="p-3 text-slate-500">{l.user_id?.slice(0, 8) || "system"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!logs || logs.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No activity recorded for this company</p>}
      </div>
    </div>
  );
}
