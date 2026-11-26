import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

const badge = (s: string) =>
  ["active", "trialing"].includes(s) ? "bg-emerald-500/15 text-emerald-400"
  : ["past_due", "payment_pending", "payment_failed", "grace"].includes(s) ? "bg-amber-500/15 text-amber-400"
  : ["expired", "suspended", "cancelled"].includes(s) ? "bg-rose-500/15 text-rose-400"
  : "bg-slate-700 text-slate-400";

/** Subscription detail (plan §6): the full record, its event history and
 *  invoices for the owning company. State changes live on the company page
 *  (suspend/reactivate/change plan) — this is the auditable read view. */
export default async function SubscriptionDetail({ params }: { params: { id: string } }) {
  await requirePlatform();
  const admin = supabaseAdmin();
  const { data: sub } = await admin.from("org_subscriptions").select("*").eq("id", params.id).maybeSingle();
  if (!sub) notFound();

  const [{ data: orgRow }, { data: planRow }, { data: events }, { data: invoices }] = await Promise.all([
    admin.from("organizations").select("id, name").eq("id", sub.org_id).maybeSingle(),
    admin.from("billing_plans").select("name, code, price_minor, interval").eq("id", sub.plan_id).maybeSingle(),
    admin.from("subscription_events").select("event_type, payload, actor_id, created_at")
      .eq("org_id", sub.org_id).order("created_at", { ascending: false }).limit(25),
    admin.from("subscription_invoices")
      .select("id, invoice_no, amount_minor, tax_minor, status, issued_at, paid_at")
      .eq("org_id", sub.org_id).order("issued_at", { ascending: false }).limit(10),
  ]);

  const money = (p: number | null) => (p == null ? "—" : `₹${(Number(p) / 100).toLocaleString("en-IN")}`);
  const fields: [string, string][] = [
    ["Status", sub.status],
    ["Plan", planRow ? `${planRow.name} (${planRow.code})` : "—"],
    ["Auto-renew", sub.auto_renew ? "On" : "Off"],
    ["Trial ends", sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleString() : "—"],
    ["Grace ends", sub.grace_ends_at ? new Date(sub.grace_ends_at).toLocaleString() : "—"],
    ["Period start", sub.current_period_start ? new Date(sub.current_period_start).toLocaleString() : "—"],
    ["Period end", sub.current_period_end ? new Date(sub.current_period_end).toLocaleString() : "—"],
    ["Cancelled at", sub.cancelled_at ? new Date(sub.cancelled_at).toLocaleString() : "—"],
    ["Reactivated at", sub.reactivated_at ? new Date(sub.reactivated_at).toLocaleString() : "—"],
    ["Payment method", sub.payment_method ?? "—"],
    ["Created", sub.created_at ? new Date(sub.created_at).toLocaleString() : "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/platform/subscriptions" className="text-slate-400 hover:text-white">← Subscriptions</Link>
        <h2 className="text-2xl font-semibold">{orgRow?.name ?? "Subscription"}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${badge(sub.status)}`}>{sub.status}</span>
        <Link href={`/platform/companies/${sub.org_id}`} className="ml-auto text-sm text-gold-400 hover:underline">
          Manage on company page →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold">Subscription record</p>
          <dl className="grid grid-cols-2 gap-x-6 text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-800 py-1.5">
                <dt className="text-slate-400">{k}</dt>
                <dd className="capitalize text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">id: {sub.id}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="mb-3 text-sm font-semibold">Latest invoices</p>
          <ul className="space-y-1.5 text-sm">
            {(invoices ?? []).map((i: any) => (
              <li key={i.id} className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">{i.invoice_no || "—"}</span>
                <span>{money(i.amount_minor)}</span>
                <span className={`capitalize ${i.status === "paid" ? "text-emerald-400" : i.status === "failed" ? "text-rose-400" : "text-amber-400"}`}>{i.status}</span>
              </li>
            ))}
          </ul>
          {!(invoices ?? []).length && <p className="text-sm text-slate-500">No invoices yet.</p>}
          <p className="mt-3 text-xs text-slate-500">
            <Link href={`/platform/companies/${sub.org_id}`} className="text-gold-400 hover:underline">All invoices →</Link>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <p className="border-b border-slate-800 px-4 py-3 text-sm font-semibold">Event history</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Actor</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(events ?? []).map((e: any, i: number) => (
              <tr key={i} className="hover:bg-slate-900/50">
                <td className="px-4 py-3 text-slate-400">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{e.event_type}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{e.actor_id ? e.actor_id.slice(0, 8) : "system"}</td>
              </tr>
            ))}
            {!(events ?? []).length && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No events recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
