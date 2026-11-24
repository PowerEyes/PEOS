import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

/** Plan detail (plan §6): full configuration + which companies are on it.
 *  Editing stays on /platform/plans (PlanRow) — this page is the read view. */
export default async function PlanDetail({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: plan }, { data: subs }, { data: orgs }] = await Promise.all([
    admin.from("billing_plans").select("*").eq("id", params.id).maybeSingle(),
    admin.from("org_subscriptions").select("org_id, status, current_period_end, trial_ends_at, created_at")
      .eq("plan_id", params.id).order("created_at", { ascending: false }),
    admin.from("organizations").select("id, name"),
  ]);
  if (!plan) notFound();

  const orgName = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));
  const money = (p: number | null) => (p == null ? "Custom pricing" : `₹${(Number(p) / 100).toLocaleString("en-IN")}`);
  const features = (plan.features ?? {}) as Record<string, unknown>;
  const LIVE = ["trialing", "active", "past_due", "payment_pending", "payment_failed"];
  const live = (subs ?? []).filter((s: any) => LIVE.includes(s.status)).length;

  const config: [string, string | number][] = [
    ["Price", `${money(plan.price_minor)} / ${plan.interval}`],
    ["Trial period", `${plan.trial_days ?? 0} days`],
    ["Grace after failed payment", `${plan.grace_days ?? 0} days`],
    ["Max branches", plan.max_branches ?? "unlimited"],
    ["Max employees", plan.max_employees ?? "unlimited"],
    ["Max customers", plan.max_customers ?? "unlimited"],
    ["Storage", plan.storage_mb != null ? `${plan.storage_mb} MB` : "unlimited"],
    ["Display order", plan.display_order ?? 0],
    ["Public signup", plan.is_public ? "Yes" : "No"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/platform/plans" className="text-slate-400 hover:text-white">← Plans</Link>
        <h2 className="text-2xl font-semibold">{plan.name}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{plan.code}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${plan.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
          {plan.active ? "Live" : "Draft"}
        </span>
        <span className="ml-auto text-sm text-slate-400">
          {subs?.length ?? 0} subscription{(subs?.length ?? 0) === 1 ? "" : "s"} · {live} live
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="mb-3 text-sm font-semibold">Configuration</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {config.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-800 py-1.5">
                <dt className="text-slate-400">{k}</dt>
                <dd className="capitalize text-slate-200">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="mb-3 text-sm font-semibold">Feature entitlements</p>
          {Object.keys(features).length === 0 ? (
            <p className="text-sm text-slate-500">No feature flags set — plan inherits the default feature set.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(features).map(([k, v]) => (
                <span key={k}
                  className={`rounded-full px-2.5 py-1 text-xs ${v ? "bg-gold-500/15 text-gold-400" : "bg-slate-800 text-slate-500 line-through"}`}>
                  {k}
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Edit pricing, limits and features on the <Link href="/platform/plans" className="text-gold-400 hover:underline">plans list</Link>.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <p className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Companies on this plan</p>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial ends</th><th className="px-4 py-3">Period ends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(subs ?? []).map((s: any, i: number) => (
              <tr key={i} className="hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <Link href={`/platform/companies/${s.org_id}`} className="text-white hover:text-gold-400">
                    {orgName.get(s.org_id) ?? s.org_id}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{s.status}</td>
                <td className="px-4 py-3 text-slate-400">{s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-slate-400">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {!(subs ?? []).length && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No company is on this plan yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
