import { supabaseServer } from "@/lib/supabase/server";
import { fmt } from "@poweros/business-rules";
import { PrintButton } from "@/components/PrintButton";
import { getScopeCtx } from "@/lib/branch-scope";
export default async function BuyingList({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = (searchParams.ids ?? "").split(",").filter(Boolean);
  const { scope } = await getScopeCtx(); let q=supabaseServer().from("lab_orders").select("*").in("id", ids); if(scope)q=q.eq("branch_id",scope);
  const { data } = await q.order("lens_desc");
  const rows = data ?? []; const th = "border border-slate-300 px-1.5 py-1"; const e = (l: any, s: string) => `${fmt(l[`${s}_sph`]) || "0.00"} / ${fmt(l[`${s}_cyl`]) || "0.00"} x ${l[`${s}_axis`] ?? "-"}${l[`${s}_add`] ? ` +${Number(l[`${s}_add`]).toFixed(2)}` : ""}`;
  return (<div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0"><style>{`@page{size:A5 portrait;margin:0}@media print{html,body{background:#fff}}`}</style>
    <div className="mx-auto mb-4 flex w-[148mm] justify-end print:hidden"><PrintButton label="Print buying list" /></div>
    <div className="mx-auto min-h-[210mm] w-[148mm] bg-white p-[7mm] text-[8.5pt] shadow-xl print:shadow-none"><h1 className="font-display text-[15pt] font-bold text-navy-900">Lens buying list</h1><p className="mb-2 text-slate-600">{new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} | {rows.length} jobs</p>
      <table className="w-full border-collapse"><thead><tr className="bg-navy-900 text-white"><th className={th}>Job</th><th className={`${th} text-left`}>Lens</th><th className={th}>Right (SPH / CYL x AXIS)</th><th className={th}>Left</th></tr></thead>
        <tbody>{rows.map((l: any) => <tr key={l.id}><td className={`${th} font-medium`}>{l.code}</td><td className={th}>{l.lens_desc}{l.lens_details && <span className="block text-[7pt] text-slate-500">{l.lens_details}</span>}</td><td className={`${th} text-center`}>{e(l, "od")}</td><td className={`${th} text-center`}>{e(l, "os")}</td></tr>)}</tbody></table></div></div>);
}
