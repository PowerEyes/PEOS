import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanyActivityPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: company } = await sb.from("tenants").select("name").eq("id", params.id).single();
  const { data: logs } = await sb.from("audit_logs").select("*").eq("tenant_id", params.id).order("created_at", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{company?.name} — Activity Logs</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Time</th><th className="text-left p-3">Action</th><th className="text-left p-3">User</th><th className="text-left p-3">Details</th></tr></thead>
          <tbody>
            {logs?.map((l: any) => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.user_id?.slice(0, 8) || "—"}</td>
                <td className="p-3 text-slate-500">{l.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!logs || logs.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No activity logs</p>}
      </div>
    </div>
  );
}