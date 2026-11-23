import { notFound } from "next/navigation";
import { inr } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";

// Tax invoice for a SaaS subscription. RLS scopes the read to the caller's org, so
// a session can only ever print its own invoices. Same print route convention as
// receipts/credit notes: browser print → Save as PDF (see PrintButton).
export default async function SubscriptionInvoicePrint({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) notFound();

  const [{ data: inv }, { data: identity }] = await Promise.all([
    sb.from("subscription_invoices")
      .select("*, plan:billing_plans(name, code, interval)")
      .eq("id", params.id)
      .maybeSingle(),
    sb.rpc("platform_billing_identity"),
  ]);
  if (!inv) notFound();

  const { data: org } = await sb.from("organizations")
    .select("name, legal_name, billing_address")
    .eq("id", inv.org_id)
    .maybeSingle();
  const { data: seller } = await sb.from("organizations").select("name").limit(1).maybeSingle();

  const total = Number(inv.amount_minor) || 0;
  const tax = Number(inv.tax_minor) || 0;
  const taxable = total - tax;
  const cgst = Math.round(tax / 2);
  const sgst = tax - cgst;
  const rateBp = Number(identity?.gst_rate_bp ?? 1800);
  const gstin = String(identity?.gstin ?? "");

  const d = (x?: string | null) => (x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const th = "border border-slate-300 px-2 py-1.5";

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{`@page{size:A4 portrait;margin:12mm}@media print{html,body{background:#fff}}`}</style>
      <div className="mx-auto mb-4 flex w-[186mm] justify-end print:hidden">
        <PrintButton label="Download invoice (PDF)" />
      </div>

      <div className="mx-auto w-[186mm] bg-white p-8 text-[9.5pt] shadow-xl print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-navy-800 pb-3">
          <div>
            <h1 className="font-display text-[18pt] font-bold text-navy-900">{seller?.name ?? "PowerOS"}</h1>
            <p className="text-[8pt] text-slate-500">Subscription tax invoice</p>
          </div>
          <div className="text-right">
            <p className="text-[13pt] font-bold text-navy-900">TAX INVOICE</p>
            <p className="text-[8.5pt]">No: <b>{inv.invoice_no}</b></p>
            <p className="text-[8.5pt]">Issued: {d(inv.issued_at)}</p>
            {inv.due_at && <p className="text-[8.5pt]">Due: {d(inv.due_at)}</p>}
            {gstin && <p className="text-[8.5pt]">GSTIN: <b>{gstin}</b></p>}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[7.5pt] uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="font-semibold text-navy-900">{org?.legal_name || org?.name}</p>
            {org?.billing_address && <p className="text-slate-600">{org.billing_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-[7.5pt] uppercase tracking-wide text-slate-400">Status</p>
            <p className="font-semibold uppercase text-navy-900">{inv.status}</p>
            {inv.paid_at && <p className="text-slate-600">Paid on {d(inv.paid_at)}</p>}
            {inv.currency && <p className="text-slate-600">Currency: {inv.currency}</p>}
          </div>
        </section>

        <table className="mt-5 w-full border-collapse text-[9pt]">
          <thead>
            <tr className="bg-navy-800 text-white">
              <th className={`${th} text-left`}>Description</th>
              <th className={`${th} text-center`}>Period</th>
              <th className={`${th} text-right`}>Taxable</th>
              <th className={`${th} text-right`}>GST {rateBp / 100}%</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={th}>
                <b>{(inv.plan as any)?.name ?? "Subscription"}</b>
                <br />
                <span className="text-slate-500">
                  PowerOS {(inv.plan as any)?.interval ? `${(inv.plan as any).interval}ly` : ""} subscription
                  {inv.plan?.code ? ` · ${inv.plan.code}` : ""}
                </span>
              </td>
              <td className={`${th} text-center`}>{d(inv.issued_at)}</td>
              <td className={`${th} text-right`}>{inr(taxable / 100)}</td>
              <td className={`${th} text-right`}>{inr(tax / 100)}</td>
              <td className={`${th} text-right font-semibold`}>{inr(total / 100)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-[9.5pt]">
            <p className="flex justify-between"><span className="text-slate-600">Taxable value</span><span>{inr(taxable / 100)}</span></p>
            <p className="flex justify-between"><span className="text-slate-600">CGST @ {(rateBp / 200).toFixed(2)}%</span><span>{inr(cgst / 100)}</span></p>
            <p className="flex justify-between"><span className="text-slate-600">SGST @ {(rateBp / 200).toFixed(2)}%</span><span>{inr(sgst / 100)}</span></p>
            <p className="flex justify-between border-t border-slate-400 pt-1 text-[13pt] font-bold text-navy-900">
              <span>Total</span><span>{inr(total / 100)}</span>
            </p>
          </div>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-[7.5pt] text-slate-500">
          <p>
            This is a computer-generated invoice issued for the PowerOS subscription and is valid without a physical
            signature. GST is charged at {rateBp / 100}% on the taxable value of the subscription.
          </p>
          {inv.status !== "paid" && (
            <p className="mt-1 font-semibold text-amber-700">
              This invoice is not yet paid. Payment settles automatically through Razorpay.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
