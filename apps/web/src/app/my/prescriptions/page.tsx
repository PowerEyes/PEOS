import { PortalPageHeader } from "@/components/PortalPageHeader";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { inr } from "@/lib/types";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
const fmt=(n:number|null|undefined)=>n==null?"—":`${n>=0?"+":""}${Math.abs(n).toFixed(2)}`;
export default async function PrescriptionsPage() {
  const site = await getSiteSettings();
  const customer = await getCustomer(); if (!customer) redirect("/my/login");
  const { data: rxs, error: rxError } = await supabaseServer().from("prescriptions").select("id,rx_code,rx_date,valid_till,rx_type,od_sph,od_cyl,od_axis,od_add,os_sph,os_cyl,os_axis,os_add,pd_far,pd_near,examined_by,status").eq("customer_id",customer.id).order("rx_date",{ascending:false}).limit(20);
  const isActive=(r:any)=>r.status === "active" && (!r.valid_till || new Date(`${r.valid_till}T23:59:59`) >= new Date());
  return (
    <div className="space-y-5">
      <PortalPageHeader title="My Prescriptions" description="Review prescription details, validity, and download or use them when shopping." action={<a href={waHref(site.whatsappNumber, "I'd like to upload my prescription")} target="_blank" className="btn-gold text-sm"><Plus size={15}/>Upload Rx</a>}/>
      {!rxError && rxs && rxs.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ["Total records", rxs.length],
        ["Active", rxs.filter(isActive).length],
        ["Expiring in 30 days", rxs.filter((r:any)=>isActive(r) && r.valid_till && new Date(`${r.valid_till}T23:59:59`) <= new Date(Date.now()+30*86400000)).length],
        ["Expired", rxs.filter((r:any)=>!isActive(r)).length],
      ].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy-900">{value}</p></div>)}</div>}
      {rxError ? (
        <div role="alert" className="card border-amber-200 p-8 text-center"><p className="font-semibold text-amber-800">Prescription records unavailable</p><p className="mt-2 text-sm text-slate-500">We could not load your prescriptions. Please refresh or contact support.</p></div>
      ) : !rxs?.length ? (
        <div className="card p-16 text-center"><FileText size={40} className="mx-auto mb-3 text-slate-300"/><p className="font-semibold text-slate-600">No prescriptions yet</p><Link href="/eye-test" className="btn-gold mt-5 inline-flex">Book an Eye Test</Link></div>
      ) : (
        <div className="space-y-3">{rxs.map(r => (
          <div key={r.id} className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div><p className="font-bold">{r.rx_code}</p><p className="text-xs text-slate-400">{new Date(r.rx_date).toLocaleDateString("en-IN",{dateStyle:"medium"})}{r.examined_by?` · Dr. ${r.examined_by}`:""}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive(r)?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-600"}`}>{isActive(r)?`Valid till ${new Date(r.valid_till).toLocaleDateString("en-IN",{dateStyle:"medium"})}`:"Expired"}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[["od","Right Eye (OD)","blue"],["os","Left Eye (OS)","orange"]].map(([s,l,c])=>(
                <div key={s} className={`rounded-xl border p-3 ${c==="blue"?"border-blue-100 bg-blue-50/50":"border-orange-100 bg-orange-50/50"}`}>
                  <p className={`text-xs font-semibold mb-1 ${c==="blue"?"text-blue-700":"text-orange-600"}`}>{l}</p>
                  <p className="font-mono text-xs">{fmt((r as any)[`${s}_sph`])} / {fmt((r as any)[`${s}_cyl`])} × {(r as any)[`${s}_axis`]??0}{(r as any)[`${s}_add`]?` ADD ${fmt((r as any)[`${s}_add`])}`:""}</p>
                </div>))}</div>
            {r.pd_far&&<p className="text-xs text-slate-500 mt-2">PD: {r.pd_far} / {r.pd_near??r.pd_far} mm</p>}
            <div className="mt-3 flex gap-2"><a href={`/print/rx/${r.id}`} target="_blank" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-navy-700 transition">Print Rx</a><Link href={`/eyeglasses`} className="rounded-full border border-gold-400 px-3 py-1.5 text-xs font-medium text-gold-700 hover:bg-amber-50 transition">Shop with this Rx</Link></div>
          </div>))}
        </div>)}
    </div>);
}
