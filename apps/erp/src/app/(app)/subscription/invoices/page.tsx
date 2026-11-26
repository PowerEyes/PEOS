import Link from "next/link";
import { redirect } from "next/navigation";
import { inr } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";

const INVOICE_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  issued: "bg-sky-100 text-sky-700",
  overdue: "bg-amber-100 text-amber-700",
  void: "bg-slate-100 text-slate-500",
  credited: "bg-slate-100 text-slate-500",
};

const date = (x?: string | null) =>
  x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (minor: number | null | undefined, currency = "INR") =>
  currency === "INR" ? inr((Number(minor) || 0) / 100) : `${((Number(minor) || 0) / 100).toFixed(2)} ${currency}`;

export default async function BillingHistoryPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.org_id as string | undefined;
  if (!orgId) {
    return <div className="card p-6 text-sm text-slate-500">Your account is not linked to an organisation yet.</div>;
  }

  const [{ data: invoices }, { data: payments }, { data: org }] = await Promise.all([
    sb.from("subscription_invoices")
      .select("id, invoice_no, amount_minor, tax_minor, currency, status, issued_at, due_at, paid_at, plan:billing_plans(name, interval)")
      .eq("org_id", orgId)
      .order("issued_at", { ascending: false })
      .limit(200),
    sb.from("subscription_payments")
      .select("id, invoice_id, provider, provider_payment_id, status, amount_minor, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("organizations").select("name").eq("id", orgId).maybeSingle(),
  ]);

  const rows = invoices ?? [];
  const paidTotal = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount_minor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Billing history</h1>
          <p className="text-sm text-slate-500">Invoices and payments for {org?.name}</p>
        </div>
        <Link href="/subscription" className="btn btn-ghost">Back to subscription</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-slate-500">Invoices</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{rows.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Paid to date</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{money(paidTotal)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">Payments recorded</p>
          <p className="mt-1 text-2xl font-bold text-navy-900">{payments?.length ?? 0}</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Invoices</h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No invoices yet — they appear after your first payment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Issued</th>
                <th className="px-6 py-3 font-medium">Paid</th>
                <th className="px-6 py-3 text-right font-medium">Taxable</th>
                <th className="px-6 py-3 text-right font-medium">GST</th>
                <th className="px-6 py-3 text-right font-medium">Total</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100">
                  <td className="px-6 py-3 font-medium text-navy-900">{inv.invoice_no || "—"}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {(inv.plan as any)?.name ?? "—"}
                    {inv.plan ? <span className="text-slate-400"> / {(inv.plan as any).interval}</span> : null}
                  </td>
                  <td className="px-6 py-3 text-slate-500">{date(inv.issued_at)}</td>
                  <td className="px-6 py-3 text-slate-500">{inv.status === "paid" ? date(inv.paid_at) : "—"}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{money(Number(inv.amount_minor) - Number(inv.tax_minor), inv.currency)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{money(inv.tax_minor, inv.currency)}</td>
                  <td className="px-6 py-3 text-right font-medium text-navy-900">{money(inv.amount_minor, inv.currency)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STYLE[inv.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link href={`/print/subscription-invoice/${inv.id}`} className="text-navy-800 hover:underline">
                      Download
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h2>
        </div>
        {!payments?.length ? (
          <p className="px-6 py-6 text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Provider</th>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 text-right font-medium">Amount</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-6 py-3 text-slate-600">{date(p.created_at)}</td>
                  <td className="px-6 py-3 text-slate-600">{p.provider ?? "—"}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.provider_payment_id ?? "—"}</td>
                  <td className="px-6 py-3 text-right font-medium text-navy-900">{money(p.amount_minor)}</td>
                  <td className="px-6 py-3 text-right text-slate-600">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
