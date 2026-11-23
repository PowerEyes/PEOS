import { notFound } from "next/navigation";
import { printSb } from "@/lib/doclinks";
import { PrintButton } from "@/components/PrintButton";
import { getScopeCtx } from "@/lib/branch-scope";
export default async function ApptPrint({ params, searchParams }: { params: { id: string }; searchParams: { dt?: string } }) {
  const sb = await printSb("appointment", params.id, searchParams?.dt);
  const { scope } = await getScopeCtx(); let q=sb.from("appointments").select("*, customers(full_name), branches(name, address, phone)").eq("id", params.id); if(scope)q=q.eq("branch_id",scope);
  const { data: a } = await q.single();
  if (!a) notFound();
  const { data: org } = await sb.from("organizations").select("name").limit(1).maybeSingle();
  const b = a.branches;
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] max-w-full justify-end px-4 print:hidden"><PrintButton label="Print slip" /></div>
    <div className="flex justify-center"><div className="min-h-[100mm] w-[148mm] bg-white p-[8mm] text-[10pt] shadow-xl print:shadow-none">
      <header className="border-b-2 border-gold-500 pb-2"><h1 className="font-display text-[14pt] font-bold uppercase text-navy-900">{org?.name}</h1></header>
      <h2 className="mt-3 text-[12pt] font-bold text-navy-900">APPOINTMENT CONFIRMATION</h2>
      <p className="mt-2">Dear <b>{a.customers?.full_name}</b>, your <b>{a.appt_type}</b> is booked.</p>
      <p className="mt-2 text-[12pt] font-semibold">{new Date(a.appt_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {String(a.appt_time).slice(0, 5)}</p>
      <p className="mt-2 text-slate-600">{b?.name}<br />{b?.address}<br />Ph: {b?.phone}</p>
      <p className="mt-6 text-[8pt] text-slate-500">Please carry your previous prescription and glasses, if any.</p>
    </div></div></div>);
}
