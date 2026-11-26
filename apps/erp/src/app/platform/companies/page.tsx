import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { RegisterCompanyForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function PlatformCompanies() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: orgs }, { data: plans }, { data: subs }] = await Promise.all([
    admin.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("billing_plans").select("id, code, name"),
    admin.from("org_subscriptions").select("org_id, plan_id, status, current_period_end").order("created_at", { ascending: false }),
  ]);
  const subByOrg = new Map<string, any>();
  for (const s of subs ?? []) if (!subByOrg.has(s.org_id)) subByOrg.set(s.org_id, s);
  const planName = new Map((plans ?? []).map((p: any) => [p.id, p.name]));
  const statusStyle = (s?: string) =>
    s === "active" ? "bg-emerald-500/15 text-emerald-400" : s === "trialing" ? "bg-sky-500/15 text-sky-400"
    : s === "past_due" || s === "grace" ? "bg-amber-500/15 text-amber-400"
    : s === "suspended" || s === "expired" || s === "cancelled" ? "bg-rose-500/15 text-rose-400" : "bg-slate-700 text-slate-300";
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Companies</h2>
          <p className="text-sm text-slate-400">{(orgs ?? []).length} registered organisations</p>
        </div>
        <RegisterCompanyForm plans={(plans ?? []).filter((p: any) => p.code !== "legacy")} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Period ends</th><th className="px-4 py-3">Registered</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(orgs ?? []).map((o: any) => {
              const s = subByOrg.get(o.id);
              return (
                <tr key={o.id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3"><Link href={`/platform/companies/${o.id}`} className="font-medium text-white hover:text-gold-400">{o.name}</Link></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle(s?.status)}`}>{s?.status ?? "none"}</span></td>
                  <td className="px-4 py-3 text-slate-400">{planName.get(s?.plan_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{s?.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {!(orgs ?? []).length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No companies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
