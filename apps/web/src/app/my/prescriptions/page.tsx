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
  const { data: rxs } = await supabaseServer().from("prescriptions").select("id,rx_code,rx_date,valid_till,rx_type,od_sph,od_cyl,od_axis,od_add,os_sph,os_cyl,os_axis,os_add,pd_far,pd_near,examined_by,status").eq("customer_id",customer.id).order("rx_date",{ascending:false}).limit(20);
  const isActive=(r:any)=>r.valid_till&&new Date(r.valid_till)>new Date();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-bold text-navy-900">My Prescriptions</h1>
        <a href={waHref(site.whatsappNumber, "I'd like to upload my prescription")} target="_blank" className="btn-gold text-sm"><Plus size={15}/>Upload Rx</a></div>
      {!rxs?.length ? (
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
