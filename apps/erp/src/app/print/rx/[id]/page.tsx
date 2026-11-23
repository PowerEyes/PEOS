import { notFound } from "next/navigation";
import { printSb } from "@/lib/doclinks";
import { fmt } from "@poweros/business-rules";
import { ageFrom } from "@/lib/types";
import { PrintBar } from "./print-bar";
import { getScopeCtx } from "@/lib/branch-scope";
export default async function RxPrint({ params, searchParams }: { params: { id: string }; searchParams: { dt?: string } }) {
  const sb = await printSb("rx", params.id, searchParams?.dt);
  const { scope } = await getScopeCtx(); let rxq=sb.from("prescriptions").select("*, customers(*)").eq("id", params.id); if(scope)rxq=rxq.eq("branch_id",scope);
  const { data: r } = await rxq.single();
  if (!r) notFound();
  const bq = sb.from("branches").select("*");
  const { data: b } = r.branch_id ? await bq.eq("id", r.branch_id).single() : await bq.order("code").limit(1).single();
  const { data: org } = await sb.from("organizations").select("name").limit(1).maybeSingle();
  const c = r.customers; const d = (x: string) => new Date(x).toLocaleDateString("en-IN");
  const row = (label: string, k: "sph" | "cyl" | "axis" | "va_dist") => [label, ...(["od", "os"] as const).map((s) => r[`${s}_${k}`])];
  const cell = "border border-slate-300 px-2 py-1 text-center";
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
    <style>{`@page{size:A5 landscape;margin:0}@media print{html,body{background:#fff}}`}</style>
    <PrintBar />
    <div className="w-full overflow-x-auto px-2 sm:px-0 flex justify-center">
      <div className="relative mx-auto flex h-[148mm] w-[210mm] shrink-0 flex-col overflow-hidden bg-white text-[9pt] shadow-xl print:shadow-none">
      <header className="flex items-stretch justify-between bg-white">
        <div className="px-[8mm] py-[4mm]"><h1 className="font-display text-[19pt] font-bold uppercase leading-none text-navy-900">{org?.name ?? "Power Eyes Opticals"}</h1>
          <p className="mt-1 font-medium text-gold-600">Since 1998 | Your Family&apos;s Vision Partner</p></div>
        <div className="flex flex-col justify-center bg-navy-900 px-[8mm] text-white" style={{ clipPath: "polygon(8% 0,100% 0,100% 100%,0 100%)" }}>
          <p className="text-[13pt] font-bold tracking-wide">SPECTACLE PRESCRIPTION</p><p className="text-[7pt] tracking-widest text-gold-400">CLEARER VISION. BRIGHTER LIVES.</p></div></header>
      <div className="mx-[8mm] border-y border-gold-400 py-[2mm] text-[8pt]"><b className="uppercase">{b?.name}</b> | {b?.address} | {b?.phone} | {b?.email} {b?.udyam_no && `| ${b.udyam_no}`}</div>
      <section className="mx-[8mm] mt-[3mm] grid grid-cols-2 gap-x-6 rounded-lg bg-navy-50 p-[3mm] leading-snug">
        <div><p className="font-bold text-navy-800">CUSTOMER DETAILS</p>
          <p>Customer ID: {c.customer_code} ({c.vision_id})</p><p>Name: <b>{c.full_name}</b></p><p>Age / Gender: {ageFrom(c.dob) ?? "-"} / {c.gender ?? "-"}</p><p>Phone: {c.phone}</p></div>
        <div><p>Prescription No: <b>{r.rx_code}</b></p><p>Date: {d(r.rx_date)}</p><p>Optometrist: {r.examined_by || "-"}</p><p>Type: {r.rx_type} | Purpose: {r.purpose}</p><p>Valid till: {d(r.valid_till)}</p></div></section>
      <table className="mx-[8mm] mt-[3mm] border-collapse text-[9pt]"><thead><tr className="bg-navy-900 text-white"><th className={cell}>Parameter</th><th className={cell}>RIGHT EYE (OD)</th><th className={cell}>LEFT EYE (OS)</th></tr></thead>
        <tbody>{[row("SPH", "sph"), row("CYL", "cyl"), row("AXIS", "axis"), row("V/A distance", "va_dist")].map(([l, a, bb]: any) =>
          <tr key={l}><td className={`${cell} text-left font-medium`}>{l}</td><td className={cell}>{l === "SPH" || l === "CYL" ? fmt(a) : a ?? "-"}</td><td className={cell}>{l === "SPH" || l === "CYL" ? fmt(bb) : bb ?? "-"}</td></tr>)}
          <tr><td className={`${cell} text-left font-medium`}>Near ADD / V/A</td><td className={cell}>{fmt(r.od_add) || "-"} {r.od_va_near}</td><td className={cell}>{fmt(r.os_add) || "-"} {r.os_va_near}</td></tr>
          <tr><td className={`${cell} text-left font-medium`}>PD far / near</td><td className={cell} colSpan={2}>{r.pd_far ?? "-"} / {r.pd_near ?? "-"} mm</td></tr></tbody></table>
      <section className="mx-[8mm] mt-auto mb-[3mm] flex items-end justify-between gap-6 text-[8pt]">
        <ul className="list-disc pl-4 leading-snug"><li>Use lenses and frames as recommended.</li><li>Regular eye check-up is advised every 12 months.</li><li>If you experience any discomfort, please visit us.</li>{r.remarks && <li>{r.remarks}</li>}</ul>
        <div className="w-44 border-t border-navy-900 pt-1 text-center"><p className="font-semibold">{r.examined_by || "Optometrist"}</p><p>For {org?.name}</p></div></section>
      <footer className="bg-navy-900 py-[1.5mm] text-center text-[7pt] tracking-widest text-white">CARE FOR TODAY. CLEAR VISION FOR TOMORROW.</footer>
    </div></div></div>);
}
