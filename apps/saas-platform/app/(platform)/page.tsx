import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function PlatformDashboard() {
  const admin = createAdminClient();

  const [{ data: orgs }, { data: subscriptions }, { data: invitations }, { data: branches }] =
    await Promise.all([
      admin.from("organizations").select("id,name,plan,status,created_at").order("created_at", { ascending: false }).limit(10),
      admin.from("organization_subscriptions").select("id,status,plan_id"),
      admin.from("platform_invitations").select("id,status").eq("status", "pending"),
      admin.from("branches").select("org_id"),
    ]);

  const organisationList = orgs || [];
  const branchCounts = new Map<string, number>();
  for (const b of branches || []) branchCounts.set(b.org_id, (branchCounts.get(b.org_id) || 0) + 1);

  const stats = [
    { label: "Total Organisations", value: organisationList.length, change: "live", color: "text-navy-900" },
    {
      label: "Active Trials",
      value: organisationList.filter((o) => o.status === "trial").length,
      change: "live",
      color: "text-emerald-700",
    },
    {
      label: "Paid Subscriptions",
      value: (subscriptions || []).filter((s) => s.status === "active").length,
      change: "live",
      color: "text-blue-700",
    },
    {
      label: "Pending Invitations",
      value: (invitations || []).length,
      change: "live",
      color: "text-amber-700",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Platform Dashboard</h1>
          <p className="text-slate-600">Manage organisations, billing, and support</p>
        </div>
        <Link
          href="/organisations/new"
          className="bg-gold-500 hover:bg-gold-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          + Create Organisation
        </Link>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-600">{stat.label}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs text-emerald-600">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-navy-900">Recent Organisations</h3>
          <Link href="/organisations" className="text-sm text-navy-900 underline hover:text-navy-700">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left pb-3 text-navy-700">Organisation</th>
              <th className="text-left pb-3 text-navy-700">Plan</th>
              <th className="text-left pb-3 text-navy-700">Status</th>
              <th className="text-left pb-3 text-navy-700">Branch Count</th>
              <th className="text-left pb-3 text-navy-700">Created</th>
              <th className="text-left pb-3 text-navy-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organisationList.map((o) => (
              <tr key={o.id} className="border-b border-slate-200 hover:bg-navy-50">
                <td className="py-3 font-medium text-navy-900">{o.name}</td>
                <td className="py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{o.plan}</span></td>
                <td className="py-3"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">{o.status}</span></td>
                <td className="py-3">{branchCounts.get(o.id) || 0}</td>
                <td className="py-3">{fmt(o.created_at)}</td>
                <td className="py-3">
                  <Link href={`/organisations/${o.id}`} className="px-3 py-1 bg-navy-900 text-white text-xs rounded hover:bg-navy-800">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {organisationList.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">No organisations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
