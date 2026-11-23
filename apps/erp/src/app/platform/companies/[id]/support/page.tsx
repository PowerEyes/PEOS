import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-sky-100 text-sky-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-600",
};

export default async function CompanySupportPage({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: org }, { data: tickets }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", params.id).maybeSingle(),
    admin.from("support_tickets").select("id, subject, body, status, priority, created_at, updated_at")
      .eq("org_id", params.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{org?.name ?? "Company"} — Support History</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Opened</th><th className="text-left p-3">Subject</th><th className="text-left p-3">Priority</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {tickets?.map((t: any) => (
              <tr key={t.id} className="border-t align-top">
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">{t.created_at ? new Date(t.created_at).toLocaleString() : "—"}</td>
                <td className="p-3">
                  <p className="font-medium">{t.subject}</p>
                  {t.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.body}</p>}
                </td>
                <td className="p-3 capitalize text-slate-500">{t.priority || "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-600"}`}>{t.status || "unknown"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!tickets || tickets.length === 0) && (
          <div className="p-6 text-center text-slate-500">
            <p>No support tickets yet</p>
            <p className="text-sm mt-1">Tickets raised by this company appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
