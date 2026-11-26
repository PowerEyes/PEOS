import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export default async function PlatformBilling() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const [{ data: invoices }, { data: payments }, { data: orgs }] = await Promise.all([
    admin.from("subscription_invoices").select("*").order("issued_at", { ascending: false }).limit(100),
    admin.from("subscription_payments").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("organizations").select("id, name"),
  ]);
  const orgName = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));
  const total = (invoices ?? []).filter((i: any) => i.status === "paid").reduce((a: number, i: any) => a + Number(i.amount_minor), 0);
  const failed = (payments ?? []).filter((p: any) => p.status === "failed").length;
  const refunds = (payments ?? []).filter((p: any) => p.status === "refunded").reduce((a: number, p: any) => a + Number(p.amount_minor), 0);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform billing</h2>
        <p className="text-sm text-slate-400">Subscription invoices, payments, refunds and revenue.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-400">Collected</div><div className="mt-1 text-2xl font-bold">₹{(total / 100).toLocaleString("en-IN")}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-400">Failed payments</div><div className="mt-1 text-2xl font-bold">{failed}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-400">Refunded</div><div className="mt-1 text-2xl font-bold">₹{(refunds / 100).toLocaleString("en-IN")}</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="mb-2 text-sm font-semibold">Invoices</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Company</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {(invoices ?? []).map((i: any) => (
                <tr key={i.id}><td className="py-2">{orgName.get(i.org_id) ?? "—"}</td><td>₹{(Number(i.amount_minor) / 100).toFixed(2)}</td><td className="capitalize text-slate-400">{i.status}</td></tr>
              ))}
              {!(invoices ?? []).length && <tr><td colSpan={3} className="py-3 text-slate-500">No invoices.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="mb-2 text-sm font-semibold">Payments</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Company</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {(payments ?? []).map((p: any) => (
                <tr key={p.id}><td className="py-2">{orgName.get(p.org_id) ?? "—"}</td><td>₹{(Number(p.amount_minor) / 100).toFixed(2)}</td><td className="capitalize text-slate-400">{p.status}</td></tr>
              ))}
              {!(payments ?? []).length && <tr><td colSpan={3} className="py-3 text-slate-500">No payments.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
