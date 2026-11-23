import { supabaseServer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import Link from "next/link";
import { refreshUsage } from "./actions";

const METRICS = [
  { key: "branches", label: "Branches", limitKey: "branches" },
  { key: "employees", label: "Employees", limitKey: "employees" },
  { key: "customers", label: "Customers", limitKey: "customers" },
  { key: "storage_mb", label: "Storage", limitKey: "storage_mb" },
] as const;

export default async function SubscriptionUsagePage({ searchParams }: { searchParams: { e?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return null;

  const [entitlements, usageRes, snapshotRes] = await Promise.all([
    getEntitlements(profile.org_id),
    sb.rpc("org_usage", { p_org: profile.org_id }),
    sb.from("subscription_usage").select("metric, value, period_start, period_end, updated_at")
      .order("updated_at", { ascending: false }).limit(20),
  ]);
  const live = new Map<string, number>(((usageRes.data as any[]) ?? []).map((r: any) => [r.metric, Number(r.value)]));
  const snapshots = snapshotRes.data ?? [];
  const limits = (entitlements?.limits ?? {}) as Record<string, number | null>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Usage</h1>
          <p className="text-sm text-slate-500">Where your company stands against the {entitlements?.plan_name ?? "current"} plan limits</p>
        </div>
        <Link href="/subscription" className="btn btn-ghost">Back to subscription</Link>
      </div>

      {searchParams.e && (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{searchParams.e}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => {
          const value = live.get(m.key) ?? 0;
          const max = limits[m.limitKey] ?? null;
          const pct = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : null;
          return (
            <div key={m.key} className="card p-5">
              <p className="text-sm text-slate-500">{m.label}</p>
              <p className="text-3xl font-bold text-navy-900">
                {m.key === "storage_mb" ? `${value} MB` : value}
                <span className="text-sm font-normal text-slate-500"> / {max == null ? "unlimited" : max}</span>
              </p>
              {pct != null && (
                <div className="mt-3 h-1.5 rounded bg-slate-100">
                  <div className={`h-full rounded ${pct > 90 ? "bg-rose-500" : "bg-gold-500"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-navy-900">Recorded this period</p>
          <form action={refreshUsage}>
            <button type="submit" className="btn btn-outline text-sm">Refresh snapshot</button>
          </form>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Metric</th><th className="text-right p-3">Value</th><th className="text-left p-3">Period</th><th className="text-right p-3">Updated</th></tr></thead>
          <tbody>
            {snapshots.map((s: any) => (
              <tr key={`${s.metric}-${s.period_start}`} className="border-t">
                <td className="p-3 capitalize">{String(s.metric).replace(/_/g, " ")}</td>
                <td className="p-3 text-right font-medium">{Number(s.value).toLocaleString()}</td>
                <td className="p-3 text-slate-500">
                  {s.period_start ? `${new Date(s.period_start).toLocaleDateString()} – ${s.period_end ? new Date(s.period_end).toLocaleDateString() : "—"}` : "—"}
                </td>
                <td className="p-3 text-right text-xs text-slate-500">{s.updated_at ? new Date(s.updated_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">No snapshots yet — hit “Refresh snapshot” to record this period’s usage.</p>
        )}
      </div>
    </div>
  );
}
