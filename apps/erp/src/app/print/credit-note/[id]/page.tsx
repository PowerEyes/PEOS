import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { inr } from "@poweros/business-rules";
import { PrintButton } from "@/components/PrintButton";
export default async function CNPrint({ params }: { params: { id: string } }) {
  const { data: cn } = await supabaseServer().from("credit_notes").select("*, customers(*), credit_note_lines(*), branches(*)").eq("id", params.id).single();
  if (!cn) notFound();
  const { data: org } = await supabaseServer().from("organizations").select("name").single();
  const lines = cn.credit_note_lines; const d = (x: string) => new Date(x).toLocaleDateString("en-IN"); const th = "border border-slate-300 px-1.5 py-1";
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] justify-end print:hidden"><PrintButton label="Print credit note" /></div>
    <div className="mx-auto min-h-[210mm] w-[148mm] flex flex-col bg-white p-[7mm] text-[8.5pt] shadow-xl print:shadow-none">
      <header className="flex justify-between border-b-2 border-rose-500 pb-2"><div><h1 className="font-display text-[14pt] font-bold text-navy-900">{org?.name}</h1><p className="text-[7pt] text-gold-600">Since 1998 | Your Family's Vision Partner</p><p className="text-[7pt]">{cn.branches?.name}</p></div>
        <div className="text-right"><p className="text-[12pt] font-bold text-rose-700">CREDIT NOTE</p><p className="text-[7.5pt]">No: <b>{cn.code}</b></p><p className="text-[7.5pt]">Date: {d(cn.created_at)}</p><p className="text-[7.5pt]">Ref: {cn.original_sale_id?.slice(-8)}</p></div></header>
      <section className="mt-2 rounded bg-rose-50 px-3 py-1.5 text-[7.5pt]"><p><b>Customer:</b> {cn.customers?.full_name} ({cn.customers?.customer_code})</p><p>Reason: {cn.reason}</p></section>
      <table className="mt-2 w-full border-collapse text-[8pt]"><thead><tr className="bg-rose-700 text-white"><th className={th}>#</th><th className={`${th} text-left`}>Item</th><th className={th}>Qty</th><th className={th}>Taxable</th><th className={th}>CGST</th><th className={th}>SGST</th><th className={th}>Amount</th></tr></thead>
        <tbody>{lines.map((l: any, i: number) => <tr key={l.id} className="even:bg-slate-50"><td className={`${th} text-center`}>{i+1}</td><td className={th}>{l.description}</td><td className={`${th} text-center`}>{l.qty}</td><td className={`${th} text-right`}>{inr(l.taxable_value)}</td><td className={`${th} text-right`}>{l.cgst_amt > 0 ? inr(l.cgst_amt) : "-"}</td><td className={`${th} text-right`}>{l.sgst_amt > 0 ? inr(l.sgst_amt) : "-"}</td><td className={`${th} text-right font-semibold`}>{inr(l.line_total)}</td></tr>)}</tbody></table>
      <div className="ml-auto mt-3 w-48 space-y-1 text-[8.5pt]"><p className="flex justify-between"><span>CGST</span>{inr(cn.cgst_total)}</p><p className="flex justify-between"><span>SGST</span>{inr(cn.sgst_total)}</p><p className="flex justify-between border-t border-slate-400 pt-1 text-[11pt] font-bold text-rose-700"><span>Credit</span>{inr(cn.grand_total)}</p></div>
      <p className="mt-2 text-[7.5pt]">Refund method: {cn.refund_method ?? "store credit"}</p>
      <footer className="mt-auto text-[7pt] text-slate-600"><ul className="list-disc pl-4"><li>This credit note is issued under Section 34 of the CGST Act, 2017.</li><li>The original invoice {cn.original_sale_id?.slice(-8)} has not been modified.</li></ul></footer></div></div>);
}
