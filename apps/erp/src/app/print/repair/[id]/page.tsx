import { notFound } from "next/navigation";
import { printSb } from "@/lib/doclinks";
import { inr } from "@poweros/business-rules";
import { BarcodeSvg } from "@/components/BarcodeSvg";
import { PrintButton } from "@/components/PrintButton";
export default async function RepairPrint({ params, searchParams }: { params: { id: string }; searchParams: { dt?: string } }) {
  const sb = await printSb("repair", params.id, searchParams?.dt);
  const { data: r } = await sb.from("repairs").select("*, customers(*), branches(name, address, phone)").eq("id", params.id).single();
  if (!r) notFound();
  const { data: org } = await sb.from("organizations").select("name").limit(1).maybeSingle();
  const d = (x: string) => new Date(x).toLocaleDateString("en-IN"); const c = r.customers;
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] max-w-full justify-end px-4 print:hidden"><PrintButton label="Print repair card" /></div>
    <div className="w-full overflow-x-auto px-2 sm:px-0 flex justify-center">
      <div className="mx-auto min-h-[210mm] w-[148mm] shrink-0 flex flex-col bg-white p-[7mm] text-[8.5pt] shadow-xl print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-gold-500 pb-2">
          <div><h1 className="font-display text-[14pt] font-bold text-navy-900">{org?.name}</h1><p className="text-[7pt] text-gold-600">Since 1998 | Your Family's Vision Partner</p><p className="text-[7pt]">{r.branches?.name} | {r.branches?.phone}</p></div>
          <div className="text-right"><p className="text-[12pt] font-bold text-navy-900">REPAIR CARD</p><p className="text-[8pt]">{r.code}</p><BarcodeSvg value={r.code} /></div></header>
        <section className="mt-2 rounded bg-navy-50 p-2 text-[8pt]">
          <p><b>{c?.full_name}</b> ({c?.customer_code}) | {c?.phone}</p>
          {r.referred_by&&<p>Referred by: {r.referred_by}</p>}
          <p>Received: {d(r.created_at)}{r.due_date?` | Due: ${d(r.due_date)}`:""} | Priority: <b className="uppercase">{r.priority}</b></p></section>
        <p className="mt-2 font-semibold">Item</p>
        <p>{[r.item_brand,r.item_model,r.item_color,r.item_type].filter(Boolean).join(" · ")}{r.frame_no?` | Frame no: ${r.frame_no}`:""}</p>
        <p className="mt-2 font-semibold text-rose-700">Problem reported</p><p>{r.problem}</p>
        {r.technician_notes&&<><p className="mt-2 font-semibold">Technician notes</p><p>{r.technician_notes}</p></>}
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-[8.5pt]"><thead><tr className="bg-navy-900 text-white"><th className="px-2 py-1 text-left">Description</th><th className="px-2 py-1 text-right">Amount</th></tr></thead>
          <tbody><tr><td className="border-b border-slate-100 px-2 py-1">Repair charges</td><td className="border-b border-slate-100 px-2 py-1 text-right">{inr(r.repair_charges)}</td></tr>
            <tr><td className="border-b border-slate-100 px-2 py-1">Parts cost</td><td className="border-b border-slate-100 px-2 py-1 text-right">{inr(r.parts_cost)}</td></tr>
            {Number(r.discount)>0&&<tr><td className="border-b border-slate-100 px-2 py-1">Discount</td><td className="border-b border-slate-100 px-2 py-1 text-right text-rose-600">-{inr(r.discount)}</td></tr>}
            <tr className="font-bold"><td className="px-2 py-1">Total</td><td className="px-2 py-1 text-right">{inr(r.total_amount)}</td></tr></tbody></table></div>
        <div className="mt-auto grid grid-cols-3 gap-2 text-[8pt]">{["Item received & inspected","Repair completed","Customer collected"].map(t=><div key={t} className="border-t border-slate-400 pt-1"><span className="mr-1 inline-block h-3.5 w-3.5 border-2 border-slate-500" />{t}</div>)}</div>
        <div className="mt-3 flex justify-between text-[7.5pt]"><span>Customer signature: ___________</span><span>For {org?.name}</span></div>
      </div>
    </div>
  </div>);
}
