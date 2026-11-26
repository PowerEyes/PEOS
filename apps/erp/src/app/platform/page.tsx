import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ count: companies }, { data: subs }, { data: plans }, { data: recent }] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("org_subscriptions").select("status, plan_id, current_period_end"),
    admin.from("billing_plans").select("code, name, price_minor, interval, active, display_order").order("display_order"),
    admin.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const byStatus = (subs ?? []).reduce<Record<string, number>>((a, s) => { a[s.status] = (a[s.status] ?? 0) + 1; return a; }, {});
  const planById = new Map((plans ?? []).map((p: any) => [p.id ?? p.code, p]));
  const active = (subs ?? []).filter((s: any) => ["active", "trialing", "grace", "past_due"].includes(s.status));
  const mrr = active.reduce((sum: number, s: any) => {
    const p = planById.get(s.plan_id) as any;
    if (!p || p.price_minor == null) return sum;
    return sum + (p.interval === "year" ? Number(p.price_minor) / 12 : Number(p.price_minor));
  }, 0);
  const kpis = [
    { label: "Total companies", value: companies ?? 0 },
    { label: "Active subscriptions", value: byStatus["active"] ?? 0 },
    { label: "Trialing", value: byStatus["trialing"] ?? 0 },
    { label: "Past due / grace", value: (byStatus["past_due"] ?? 0) + (byStatus["grace"] ?? 0) },
    { label: "Expired / suspended", value: (byStatus["expired"] ?? 0) + (byStatus["suspended"] ?? 0) },
    { label: "MRR (₹)", value: `₹${Math.round(mrr).toLocaleString("en-IN")}` },
    { label: "ARR (₹)", value: `₹${Math.round(mrr * 12).toLocaleString("en-IN")}` },
    { label: "Public plans", value: (plans ?? []).filter((p: any) => p.active).length },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform Overview</h2>
        <p className="text-sm text-slate-400">Companies, subscriptions, revenue and platform health.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className="mt-1 text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="mb-3 text-sm font-semibold">Newest companies</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Company</th><th>Registered</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {(recent ?? []).map((c: any) => (
              <tr key={c.id}><td className="py-2">{c.name}</td><td className="text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td></tr>
            ))}
            {!(recent ?? []).length && <tr><td className="py-3 text-slate-500" colSpan={2}>No companies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
