import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default async function BillingPage() {
  const admin = createAdminClient();
  const [{ data: subs }, { data: plans }, { data: orgs }] = await Promise.all([
    admin.from("organization_subscriptions").select("id,org_id,plan_id,status,current_period_start,current_period_end,created_at").order("created_at", { ascending: false }),
    admin.from("subscription_plans").select("id,name,price_monthly"),
    admin.from("organizations").select("id,name"),
  ]);

  const planMap = new Map((plans || []).map((p) => [p.id, p]));
  const orgMap = new Map((orgs || []).map((o) => [o.id, o]));
  const list = subs || [];
  const active = list.filter((s) => s.status === "active");
  const trials = list.filter((s) => s.status === "trial");
  const mrr = active.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.price_monthly || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-navy-900">Billing</h1>
        <p className="text-slate-600">Subscriptions across all organisations</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-600">Monthly Recurring Revenue</p>
          <p className="text-3xl font-bold text-navy-900 mt-2">₹{mrr.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-600">Active Subscriptions</p>
          <p className="text-3xl font-bold text-navy-900 mt-2">{active.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-600">Trials</p>
          <p className="text-3xl font-bold text-navy-900 mt-2">{trials.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-navy-50">
            {["Organisation", "Plan", "Status", "Period start", "Period end", "Created"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-navy-700 font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 hover:bg-navy-50">
                <td className="px-4 py-3 font-medium text-navy-900">
                  <Link href={`/organisations/${s.org_id}`} className="underline">{orgMap.get(s.org_id)?.name || s.org_id}</Link>
                </td>
                <td className="px-4 py-3">{planMap.get(s.plan_id)?.name || s.plan_id}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">{s.status}</span></td>
                <td className="px-4 py-3">{fmt(s.current_period_start)}</td>
                <td className="px-4 py-3">{fmt(s.current_period_end)}</td>
                <td className="px-4 py-3">{fmt(s.created_at)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No subscriptions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
