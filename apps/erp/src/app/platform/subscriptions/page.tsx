import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export default async function PlatformSubscriptions() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: orgs }, { data: subs }, { data: plans }] = await Promise.all([
    admin.from("organizations").select("id, name"),
    admin.from("org_subscriptions").select("org_id, plan_id, status, current_period_end, trial_ends_at, created_at").order("created_at", { ascending: false }),
    admin.from("billing_plans").select("id, name"),
  ]);
  const orgName = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));
  const planName = new Map((plans ?? []).map((p: any) => [p.id, p.name]));
  const groups = ["trialing", "active", "past_due", "grace", "expired", "suspended", "cancelled", "inactive"];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Subscriptions</h2>
        <p className="text-sm text-slate-400">Every company subscription by lifecycle state.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const n = (subs ?? []).filter((s: any) => s.status === g || (g === "grace" && s.status === "past_due")).length;
          return <span key={g} className="rounded-full bg-slate-800 px-3 py-1 text-xs capitalize text-slate-300">{g}: {n}</span>;
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Trial ends</th><th className="px-4 py-3">Period ends</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(subs ?? []).map((s: any, i: number) => (
              <tr key={i} className="hover:bg-slate-900/50">
                <td className="px-4 py-3"><Link href={`/platform/companies/${s.org_id}`} className="text-white hover:text-gold-400">{orgName.get(s.org_id) ?? s.org_id}</Link></td>
                <td className="px-4 py-3 text-slate-400">{planName.get(s.plan_id) ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{s.status}</td>
                <td className="px-4 py-3 text-slate-400">{s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-slate-400">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {!(subs ?? []).length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No subscriptions.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
