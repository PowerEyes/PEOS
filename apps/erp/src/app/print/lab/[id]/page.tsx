import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@poweros/business-rules";
import { BarcodeSvg } from "@/components/BarcodeSvg";
import { PrintButton } from "@/components/PrintButton";
export default async function LabPrint({ params }: { params: { id: string } }) {
  const { data: l } = await supabaseServer().from("lab_orders").select("*, customers!lab_orders_customer_id_fkey(full_name, vision_id, phone), sales(code), branches(name)").eq("id", params.id).single();
  if (!l) notFound(); const th = "border border-slate-400 px-2 py-1 text-center"; const d = (x: string) => new Date(x).toLocaleDateString("en-IN");
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0"><style>{`@page{size:A5 landscape;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[210mm] justify-end print:hidden"><PrintButton label="Print job card" /></div>
    <div className="mx-auto flex h-[148mm] w-[210mm] flex-col bg-white p-[8mm] text-[9.5pt] shadow-xl print:shadow-none">
      <header className="flex items-start justify-between border-b-2 border-gold-500 pb-2"><div><h1 className="font-display text-[17pt] font-bold uppercase text-navy-900">Lab job card</h1><p>{l.branches?.name} | Order {l.sales?.code} | Rx {l.rx_code ?? "-"}</p></div>
        <div className="text-right"><p className="text-[15pt] font-bold">{l.code}</p><BarcodeSvg value={l.code} /></div></header>
      <section className="mt-2 grid grid-cols-3 gap-3"><p><b>Customer:</b> {l.customers.full_name}<br />{l.customers.vision_id} | {l.customers.phone}</p><p><b>Due:</b> {l.due_date ? d(l.due_date) : "-"} {l.priority === "urgent" && <b className="text-rose-600">URGENT</b>}</p><p><b>Technician:</b> {l.assigned_to ?? "__________"}</p></section>
      <table className="mt-3 w-full border-collapse"><thead><tr className="bg-navy-900 text-white"><th className={th}></th><th className={th}>SPH</th><th className={th}>CYL</th><th className={th}>AXIS</th><th className={th}>ADD</th><th className={th}>PD (far / near)</th></tr></thead>
        <tbody>{(["od", "os"] as const).map((s, i) => <tr key={s} className="text-[11pt]"><td className={`${th} font-semibold`}>{s === "od" ? "RIGHT (OD)" : "LEFT (OS)"}</td><td className={th}>{fmt(l[`${s}_sph`]) || "-"}</td><td className={th}>{fmt(l[`${s}_cyl`]) || "-"}</td><td className={th}>{l[`${s}_axis`] ?? "-"}</td><td className={th}>{fmt(l[`${s}_add`]) || "-"}</td>{i === 0 && <td className={th} rowSpan={2}>{l.pd_far ?? "-"} / {l.pd_near ?? "-"} mm</td>}</tr>)}</tbody></table>
      <p className="mt-3"><b>Lens:</b> {l.lens_desc}{l.lens_details ? ` | ${l.lens_details}` : ""}</p><p><b>Frame:</b> {l.frame_desc ?? "Customer's own frame"}</p>
      <div className="mt-auto grid grid-cols-4 gap-3 text-[9pt]">{["Lenses received", "Edging done", "Fitting done", "QC passed"].map((t) => <div key={t} className="flex items-center gap-2 border-t border-slate-400 pt-1"><span className="h-4 w-4 border-2 border-slate-500" />{t}</div>)}</div></div></div>);
}
