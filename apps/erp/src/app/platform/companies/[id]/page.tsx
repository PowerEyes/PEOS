import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { CompanySubscriptionPanel } from "./subscription-panel";

export const dynamic = "force-dynamic";

export default async function CompanyDetail({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: org }, { data: subs }, { data: plans }, { data: invoices }, { data: events }] = await Promise.all([
    admin.from("organizations").select("id, name, created_at").eq("id", params.id).maybeSingle(),
    admin.from("org_subscriptions").select("*").eq("org_id", params.id).order("created_at", { ascending: false }),
    admin.from("billing_plans").select("id, code, name, price_minor, interval, max_branches, max_employees, max_customers"),
    admin.from("subscription_invoices").select("*").eq("org_id", params.id).order("issued_at", { ascending: false }).limit(20),
    admin.from("subscription_events").select("event_type, payload, created_at").eq("org_id", params.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!org) notFound();
  const usageRes = await admin.rpc("org_usage", { p_org: org.id });
  const usage = (usageRes as any).data ?? [];
  const sub = subs?.[0];
  const plan = plans?.find((p: any) => p.id === sub?.plan_id);
  const usageRows = (usage ?? []).filter((u: any) => u.metric !== "storage_mb");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/platform/companies" className="text-slate-400 hover:text-white">← Companies</Link>
        <h2 className="text-2xl font-semibold">{org.name}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">{sub?.status ?? "no subscription"}</span>
        <nav className="ml-auto flex gap-3 text-sm">
          <Link href={`/platform/companies/${org.id}/activity`} className="text-slate-400 hover:text-gold-400">Activity</Link>
          <Link href={`/platform/companies/${org.id}/usage`} className="text-slate-400 hover:text-gold-400">Usage</Link>
          <Link href={`/platform/companies/${org.id}/support`} className="text-slate-400 hover:text-gold-400">Support</Link>
        </nav>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold">Usage vs plan limits</p>
          <div className="space-y-2">
            {usageRows.map((u: any) => {
              const key = u.metric === "branches" ? "max_branches" : u.metric === "employees" ? "max_employees" : "max_customers";
              const limit = plan ? (plan as any)[key] : null;
              const max = limit ?? null;
              const pct = max ? Math.min(100, Math.round((Number(u.value) / max) * 100)) : null;
              return (
                <div key={u.metric} className="text-sm">
                  <div className="flex justify-between"><span className="capitalize text-slate-400">{u.metric}</span><span>{u.value}{max != null ? ` / ${max}` : " (unlimited)"}</span></div>
                  {pct != null && <div className="mt-1 h-1.5 rounded bg-slate-800"><div className={`h-full rounded ${pct > 90 ? "bg-rose-500" : "bg-gold-500"}`} style={{ width: `${pct}%` }} /></div>}
                </div>
              );
            })}
            {!usageRows.length && <p className="text-sm text-slate-500">No usage data.</p>}
          </div>
        </div>
        <CompanySubscriptionPanel orgId={org.id} sub={sub} plans={plans ?? []} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-2 text-sm font-semibold">Subscription invoices</p>
          <ul className="space-y-1 text-sm">
            {(invoices ?? []).map((i: any) => (
              <li key={i.id} className="flex justify-between"><span className="text-slate-400">{new Date(i.issued_at).toLocaleDateString()}</span><span>₹{(Number(i.amount_minor) / 100).toFixed(2)}</span><span className="capitalize text-slate-500">{i.status}</span></li>
            ))}
            {!(invoices ?? []).length && <li className="text-slate-500">No invoices.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-2 text-sm font-semibold">Activity</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {(events ?? []).map((e: any, i: number) => (
              <li key={i}><span className="text-slate-300">{e.event_type}</span> · {new Date(e.created_at).toLocaleString()}</li>
            ))}
            {!(events ?? []).length && <li className="text-slate-500">No events.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
