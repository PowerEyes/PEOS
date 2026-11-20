import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { inr } from "@poweros/business-rules";
import { PrintButton } from "@/components/PrintButton";
export default async function SalePrint({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: s } = await sb.from("sales").select("*, customers!sales_customer_id_fkey(*), sale_lines(*), payments(*), branches(*)").eq("id", params.id).single();
  if (!s) notFound();
  const { data: org } = await sb.from("organizations").select("name").single();
  const { data: g } = await sb.from("org_settings").select("value").eq("key","gstin").maybeSingle();
  const { data: f } = await sb.from("org_settings").select("value").eq("key","invoice_footer").maybeSingle();
  const gstin = s.gst_applied ? (g?.value as string) : null;
  const footerNote = typeof f?.value === "string" && f.value ? f.value : null;
  const b = s.branches, c = s.customers, rx = s.rx_snapshot, isQ = s.kind === "quotation";
  const lines = [...s.sale_lines].sort((a: any, z: any) => a.line_no - z.line_no);
  const bal = Number(s.grand_total) - Number(s.paid_total);
  const d = (x: string) => new Date(x).toLocaleDateString("en-IN");
  const th = "border border-slate-300 px-1 py-0.5 text-[7.5pt]";
  const hasIGST = Number(s.igst_total) > 0;
  const hasCGST = Number(s.cgst_total) > 0;
  const invoiceType = isQ ? "QUOTATION" : s.gst_applied ? "TAX INVOICE" : "BILL OF SUPPLY";
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] max-w-full justify-end px-4 print:hidden"><PrintButton label={`Print A5 ${invoiceType}`} /></div>
    <div className="w-full overflow-x-auto px-2 sm:px-0 flex justify-center">
      <div className="flex min-h-[210mm] w-[148mm] shrink-0 flex-col bg-white p-[7mm] text-[8pt] shadow-xl print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between border-b-2 border-gold-500 pb-2">
        <div><h1 className="font-display text-[14pt] font-bold uppercase leading-none text-navy-900">{org?.name}</h1>
          <p className="mt-0.5 text-[7pt] text-gold-600">Since 1998 | Your Family's Vision Partner</p>
          <p className="mt-0.5 text-[7pt] text-slate-600">{b?.address}</p>
          <p className="text-[7pt] text-slate-600">Ph: {b?.phone}{b?.email ? ` | ${b.email}` : ""}</p>
          {gstin && <p className="text-[7pt] font-medium">GSTIN: {gstin}</p>}
          {b?.udyam_no && <p className="text-[7pt] text-slate-500">UDYAM: {b.udyam_no}</p>}</div>
        <div className="text-right"><p className="text-[11pt] font-bold text-navy-900">{invoiceType}</p>
          <p className="text-[7.5pt]">No: <b>{s.code}</b></p><p className="text-[7.5pt]">Date: {d(s.created_at)}</p>
          {isQ && s.valid_until && <p className="text-[7.5pt]">Valid till: {d(s.valid_until)}</p>}
          <p className="text-[7.5pt]">Branch: {b?.name}</p></div></header>
      {/* Customer */}
      <section className="mt-1.5 rounded bg-navy-50 px-3 py-1.5 text-[7.5pt]">
        <p><b>Bill to:</b> {c.full_name} ({c.customer_code} | {c.vision_id})</p>
        <p>Ph: {c.phone}{c.address_line1 ? ` | ${[c.address_line1, c.city, c.state].filter(Boolean).join(", ")}` : ""}</p>
        {s.recipient_gstin && <p>Customer GSTIN: {s.recipient_gstin}</p>}
        {!s.gst_applied || s.supply_type === "intrastate" ? null : <p>Inter-state supply | {s.state_of_supply}</p>}</section>
      {/* Line items */}
      <table className="mt-2 w-full border-collapse text-[7.5pt]">
        <thead><tr className="bg-navy-900 text-white"><th className={`${th} text-center`}>#</th><th className={`${th} text-left`}>Item</th><th className={`${th} text-left`}>HSN</th><th className={`${th} text-center`}>Qty</th><th className={th}>Rate</th><th className={th}>Disc</th><th className={th}>Taxable</th>
          {s.gst_applied && hasCGST && <><th className={th}>CGST</th><th className={th}>SGST</th></>}
          {s.gst_applied && hasIGST && <th className={th}>IGST</th>}<th className={`${th} font-semibold`}>Total</th></tr></thead>
        <tbody>{lines.map((l: any) => <tr key={l.id} className="even:bg-slate-50">
          <td className={`${th} text-center`}>{l.line_no}</td>
          <td className={th}>{l.description}{l.details && <span className="block text-[6.5pt] text-slate-500">{l.details}</span>}</td>
          <td className={th}>{l.hsn || "-"}</td><td className={`${th} text-center`}>{l.qty}</td>
          <td className={`${th} text-right`}>{inr(l.unit_price)}</td>
          <td className={`${th} text-center`}>{Number(l.discount_pct) > 0 ? `${l.discount_pct}%` : "-"}</td>
          <td className={`${th} text-right`}>{inr(l.taxable_value ?? l.line_total)}</td>
          {s.gst_applied && hasCGST && <><td className={`${th} text-right`}>{l.cgst_pct > 0 ? `${inr(l.cgst_amt)}\n(${l.cgst_pct}%)` : "-"}</td><td className={`${th} text-right`}>{l.sgst_pct > 0 ? `${inr(l.sgst_amt)}\n(${l.sgst_pct}%)` : "-"}</td></>}
          {s.gst_applied && hasIGST && <td className={`${th} text-right`}>{l.igst_pct > 0 ? `${inr(l.igst_amt)}\n(${l.igst_pct}%)` : "-"}</td>}
          <td className={`${th} text-right font-semibold`}>{inr(l.line_total)}</td></tr>)}</tbody></table>
      {/* Totals */}
      <div className="ml-auto mt-2 w-56 space-y-0.5 text-[8pt]">
        <p className="flex justify-between"><span className="text-slate-500">Taxable value</span>{inr(s.taxable_total || s.subtotal)}</p>
        {Number(s.discount_total) > 0 && <p className="flex justify-between text-rose-600"><span>Discount</span>-{inr(s.discount_total)}</p>}
        {s.gst_applied && hasCGST && <><p className="flex justify-between"><span className="text-slate-500">CGST</span>{inr(s.cgst_total)}</p><p className="flex justify-between"><span className="text-slate-500">SGST</span>{inr(s.sgst_total)}</p></>}
        {s.gst_applied && hasIGST && <p className="flex justify-between"><span className="text-slate-500">IGST</span>{inr(s.igst_total)}</p>}
        {!s.gst_applied && <p className="text-[7pt] text-slate-500 italic">No tax (Bill of Supply)</p>}
        <p className="flex justify-between border-t border-navy-900 pt-1 text-[10pt] font-bold"><span>Grand Total</span>{inr(s.grand_total)}</p>
        {!isQ && <><p className="flex justify-between"><span className="text-slate-500">Paid</span>{inr(s.paid_total)}</p><p className="flex justify-between font-semibold {bal>0?'text-rose-600':''}"><span>Balance</span>{inr(bal)}</p></>}</div>
      {/* Prescription snapshot */}
      {rx && <div className="mt-2 rounded bg-slate-50 p-2 text-[7.5pt]">
        <p className="font-semibold mb-1">Prescription {rx.rx_code}</p>
        <table className="w-full border-collapse"><thead><tr className="bg-navy-800 text-white"><th className="border border-slate-300 px-1 py-0.5"></th><th className="border border-slate-300 px-1 py-0.5">SPH</th><th className="border border-slate-300 px-1 py-0.5">CYL</th><th className="border border-slate-300 px-1 py-0.5">AXIS</th><th className="border border-slate-300 px-1 py-0.5">ADD</th><th className="border border-slate-300 px-1 py-0.5">PD</th></tr></thead>
          <tbody>{(["od","os"] as const).map((e,i)=><tr key={e}><td className="border border-slate-300 px-1 py-0.5 font-medium">{e==="od"?"R (OD)":"L (OS)"}</td><td className="border border-slate-300 px-1 py-0.5 text-center">{rx[`${e}_sph`]!=null?(rx[`${e}_sph`]>=0?"+":"")+Number(rx[`${e}_sph`]).toFixed(2):"-"}</td><td className="border border-slate-300 px-1 py-0.5 text-center">{rx[`${e}_cyl`]!=null?(rx[`${e}_cyl`]>=0?"+":"")+Number(rx[`${e}_cyl`]).toFixed(2):"-"}</td><td className="border border-slate-300 px-1 py-0.5 text-center">{rx[`${e}_axis`]??"-"}</td><td className="border border-slate-300 px-1 py-0.5 text-center">{rx[`${e}_add`]?"+"+Number(rx[`${e}_add`]).toFixed(2):"-"}</td>{i===0&&<td className="border border-slate-300 px-1 py-0.5 text-center" rowSpan={2}>{rx.pd_far??"-"}/{rx.pd_near??"-"}</td>}</tr>)}</tbody></table></div>}
      {/* Payments */}
      {s.payments?.length > 0 && <p className="mt-1 text-[7pt] text-slate-600">Payments: {s.payments.map((p: any) => `${d(p.created_at)} ${p.method} ${inr(p.amount)}`).join(" | ")}</p>}
      {/* Footer */}
      <footer className="mt-auto pt-3 text-[7pt] text-slate-600">
        <ul className="list-disc pl-4">{isQ?<><li>Valid for {14} days. Stock subject to availability.</li><li>This is not a tax invoice.</li></>:<><li>Goods once sold can be exchanged only as per store policy.</li><li>Carry this invoice for warranty and service claims.</li>{s.gst_applied&&<li>This is a computer-generated tax invoice.</li>}</>}</ul>
        {footerNote && <p className="mt-1 font-medium text-navy-800">{footerNote}</p>}
        <div className="mt-4 flex justify-between text-[7.5pt]"><span>Customer signature: ___________</span><span>For {org?.name}</span></div></footer></div></div></div>);
}
