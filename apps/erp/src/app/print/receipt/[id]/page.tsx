import { notFound } from "next/navigation";
import { printSb } from "@/lib/doclinks";
import { inr } from "@poweros/business-rules";
import { PrintButton } from "@/components/PrintButton";
import { getScopeCtx } from "@/lib/branch-scope";
export default async function ReceiptPrint({ params, searchParams }: { params: { id: string }; searchParams: { dt?: string } }) {
  const sb = await printSb("receipt", params.id, searchParams?.dt);
  const { scope } = await getScopeCtx(); let q=sb.from("payments").select("*, sales!inner(code, branch_id, grand_total, paid_total, customers!sales_customer_id_fkey(full_name, phone), branches(name, address, phone))").eq("id", params.id); if(scope)q=q.eq("sales.branch_id",scope);
  const { data: p } = await q.single();
  if (!p) notFound();
  const { data: org } = await sb.from("organizations").select("name").limit(1).maybeSingle();
  const s = p.sales, b = s?.branches, bal = Number(s?.grand_total) - Number(s?.paid_total);
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] max-w-full justify-end px-4 print:hidden"><PrintButton label="Print receipt" /></div>
    <div className="flex justify-center"><div className="min-h-[120mm] w-[148mm] bg-white p-[8mm] text-[9pt] shadow-xl print:shadow-none">
      <header className="border-b-2 border-gold-500 pb-2"><h1 className="font-display text-[14pt] font-bold uppercase text-navy-900">{org?.name}</h1>
        <p className="text-[7.5pt] text-slate-600">{b?.address} | Ph: {b?.phone}</p></header>
      <h2 className="mt-3 text-[12pt] font-bold text-navy-900">PAYMENT RECEIPT</h2>
      <table className="mt-2 w-full text-[9pt]"><tbody>
        <tr><td className="py-1 text-slate-500">Received from</td><td className="py-1 font-medium">{s?.customers?.full_name}</td></tr>
        <tr><td className="py-1 text-slate-500">Against order</td><td className="py-1 font-medium">{s?.code}</td></tr>
        <tr><td className="py-1 text-slate-500">Date</td><td className="py-1">{new Date(p.created_at).toLocaleString("en-IN")}</td></tr>
        <tr><td className="py-1 text-slate-500">Mode</td><td className="py-1 capitalize">{p.method}{p.reference ? ` (${p.reference})` : ""}</td></tr>
        <tr><td className="py-1 text-slate-500">Amount received</td><td className="py-1 text-[13pt] font-bold">{inr(p.amount)}</td></tr>
        <tr><td className="py-1 text-slate-500">Order total / balance</td><td className="py-1">{inr(s?.grand_total)} / {inr(Math.max(bal, 0))}</td></tr>
      </tbody></table>
      <p className="mt-6 text-[7.5pt] text-slate-500">This is a computer generated receipt. Thank you for choosing {org?.name}.</p>
    </div></div></div>);
}
