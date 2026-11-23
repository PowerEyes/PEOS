import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export default async function CompanyUsagePage({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const head = (table: string) =>
    admin.from(table).select("id", { count: "exact", head: true }).eq("org_id", params.id);

  const [{ data: org }, branches, staff, customers, products, { data: usage }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", params.id).maybeSingle(),
    head("branches"),
    head("profiles"),
    head("customers"),
    head("products"),
    admin.from("subscription_usage").select("metric, value, period_start, period_end, updated_at")
      .eq("org_id", params.id).order("updated_at", { ascending: false }).limit(12),
  ]);

  const cards = [
    { label: "Branches", count: branches.count },
    { label: "Employees", count: staff.count },
    { label: "Customers", count: customers.count },
    { label: "Products", count: products.count },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{org?.name ?? "Company"} — Usage Statistics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="text-3xl font-bold text-navy-900">{c.count ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy-900">Recorded usage</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Metric</th><th className="text-right p-3">Value</th><th className="text-left p-3">Period</th><th className="text-right p-3">Updated</th></tr></thead>
          <tbody>
            {usage?.map((u: any) => (
              <tr key={u.metric + String(u.period_start)} className="border-t">
                <td className="p-3 capitalize">{String(u.metric).replace(/_/g, " ")}</td>
                <td className="p-3 text-right font-medium">{Number(u.value).toLocaleString()}</td>
                <td className="p-3 text-slate-500">{u.period_start ? `${new Date(u.period_start).toLocaleDateString()} – ${u.period_end ? new Date(u.period_end).toLocaleDateString() : "—"}` : "—"}</td>
                <td className="p-3 text-right text-xs text-slate-500">{u.updated_at ? new Date(u.updated_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!usage || usage.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No usage recorded yet — usage snapshots land with the scheduled refresh job.</p>}
      </div>
    </div>
  );
}
