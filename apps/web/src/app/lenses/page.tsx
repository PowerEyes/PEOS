import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { inr } from "@/lib/types";
import { ChevronRight } from "lucide-react";
export const metadata = { title: "Lens Packages – Power Eyes" };
export default async function Page() {
  const [{ data: pkgs }, { data: opts }] = await Promise.all([
    supabasePublic().from("lens_packages").select("*").eq("status","active").order("display_order"),
    supabasePublic().from("lens_options").select("*").eq("status","active").order("display_order"),
  ]);
  return (<div className="min-h-screen bg-white"><Header/>
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-14 px-4 text-center text-white">
      <h1 className="font-display text-4xl font-bold">Lens Packages</h1>
      <p className="mt-2 text-slate-300">Advanced vision solutions for how you live today</p>
    </div>
    <div className="mx-auto max-w-5xl section-pad px-4 space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(pkgs??[]).map((p:any)=>(
          <div key={p.id} className="card p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-2xl">🔭</div>
            <div><p className="font-display text-xl font-bold text-navy-900">{p.name}</p><p className="text-xs text-slate-500 capitalize mt-0.5">{p.code} | {p.design?.replace("_"," ")}</p></div>
            {p.short_desc&&<p className="text-sm text-slate-600">{p.short_desc}</p>}
            <ul className="space-y-1">{(p.features||[]).slice(0,4).map((f:string)=><li key={f} className="flex items-center gap-2 text-xs text-slate-700"><span className="text-gold-500">✓</span>{f}</li>)}</ul>
            <div className="pt-2 border-t border-slate-100"><p className="text-2xl font-bold text-navy-900">from {inr(p.base_price)}</p>{p.mrp&&<p className="text-xs text-slate-400 line-through">{inr(p.mrp)}</p>}
              <div className="flex gap-1 mt-2 flex-wrap">{(p.indexes||[]).map((i:string)=><span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{i}</span>)}{(p.coatings||[]).map((c:string)=><span key={c} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">{c}</span>)}</div></div>
          </div>))}
      </div>
      <div className="card p-6"><h2 className="font-display text-2xl font-bold text-navy-900 mb-4">Add-Ons & Coatings</h2>
        <div className="grid gap-3 sm:grid-cols-2">{(opts??[]).filter((o:any)=>o.grp==="addon").map((o:any)=>(
          <div key={o.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-slate-200 to-blue-200 flex items-center justify-center">🛡️</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{o.name}{o.badge&&<span className="ml-1 text-[10px] rounded bg-amber-200 px-1.5 text-amber-900">{o.badge}</span>}</p><p className="text-xs text-slate-500 truncate">{o.description}</p></div>
            <span className="text-sm font-bold text-navy-800 shrink-0">+{inr(o.price)}</span>
          </div>))}</div></div>
      <div className="rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 p-8 text-white text-center">
        <h2 className="font-display text-2xl font-bold">Not sure which lens is right for you?</h2>
        <p className="mt-2 text-white/80">Our optometrists will help you choose the perfect lens for your lifestyle and prescription.</p>
        <div className="mt-5 flex justify-center gap-3"><Link href="/eye-test" className="btn-navy">Book Eye Test</Link><Link href="/help-me-choose" className="btn-outline">Get Expert Advice</Link></div>
      </div>
    </div>
    <Footer/></div>);
}
