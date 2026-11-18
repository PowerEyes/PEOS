
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const inr = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

export default async function WarrantyPage() {
  const site = await getSiteSettings();
  const sb = supabaseServer();
  const {data:{user}} = await sb.auth.getUser();
  if(!user) redirect("/my/login");
  const {data:c} = await sb.from("customers").select("id").eq("auth_user_id",user.id).maybeSingle();
  if(!c) redirect("/my/login");
  const {data:orders} = await sb.from("sales")
    .select("id,code,grand_total,created_at,sale_lines(description,line_total)")
    .eq("customer_id",c.id).eq("kind","order").in("status",["delivered"])
    .order("created_at",{ascending:false}).limit(20);

  const warrantyFor = (createdAt:string) => {
    const d = new Date(createdAt); d.setFullYear(d.getFullYear()+1);
    const active = d > new Date();
    return { expiry: d.toLocaleDateString("en-IN",{dateStyle:"medium"}), active };
  };

  return (
    <PortalLayout activePath="/my/warranty">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-500 text-white px-8 py-10 mb-6">
        <h1 className="font-extrabold text-3xl">WARRANTY</h1>
        <p className="text-white/80 mt-1">1-year manufacturing warranty on all frames purchased at Power Eyes Opticals.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[["🛡️","1 Year Warranty","On all frame purchases"],["🔧","Free Adjustments","Unlimited at our stores"],["🔄","Easy Claims","Visit any store with your receipt"]].map(([e,t,s])=>(
          <div key={t as string} className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3">
            <span className="text-3xl">{e}</span><div><p className="font-semibold text-navy-900">{t}</p><p className="text-xs text-slate-500">{s}</p></div>
          </div>))}
      </div>

      <h2 className="font-bold text-xl text-navy-900 mb-4">My Warranty Cards</h2>
      {(!orders||orders.length===0)
        ? <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">🛡️</div>
            <p className="font-semibold text-slate-600">No warranty records found</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Warranty applies to all delivered frame orders</p>
            <Link href="/eyeglasses" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white">Shop Eyewear</Link>
          </div>
        : <div className="space-y-4">
            {orders.map((o:any)=>{
              const w = warrantyFor(o.created_at);
              const lines = (o.sale_lines||[]);
              return (
                <div key={o.id} className={`rounded-2xl border shadow-sm p-5 ${w.active?"bg-white border-emerald-100":"bg-slate-50 border-slate-100"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-navy-900">Order #{o.code}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Purchased: {new Date(o.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})} · {inr(o.grand_total)}</p>
                      {lines.slice(0,2).map((l:any,i:number)=><p key={i} className="text-xs text-slate-600 mt-0.5">• {l.description}</p>)}
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${w.active?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>
                        {w.active?"✓ Warranty Active":"Warranty Expired"}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{w.active?"Expires":"Expired"}: {w.expiry}</p>
                    </div>
                  </div>
                  {w.active && (
                    <div className="mt-3 flex gap-2">
                      <a href={waHref(site.whatsappNumber, "I need to claim warranty for my order")} target="_blank" className="rounded-lg bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700">Claim Warranty</a>
                      <Link href="/my/repairs" className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50">Book Repair</Link>
                    </div>)}
                </div>);})}
          </div>}

      <div className="mt-6 rounded-2xl bg-navy-50 border border-navy-100 p-5 text-sm text-navy-800">
        <p className="font-bold mb-2">What does the warranty cover?</p>
        <ul className="space-y-1 text-slate-600 text-xs">
          {["Manufacturing defects in frame material","Lens coating defects (anti-reflective, scratch-resistant)","Nose pad and temple hinge defects","Not covered: accidental damage, scratches from use, lost or stolen frames"].map((t,i)=><li key={i} className={i===3?"text-rose-500":"flex items-center gap-1.5"}>{i===3?"✗":""}{i!==3&&"✓"} {t}</li>)}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Bring your original bill/receipt when visiting the store for a warranty claim.</p>
      </div>
    </PortalLayout>
  );
}
