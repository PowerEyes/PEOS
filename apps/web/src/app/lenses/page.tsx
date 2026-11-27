import { supabaseFresh } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { inr } from "@/lib/types";
import { ChevronRight } from "lucide-react";
import { LensPackageList } from "@/components/LensPackageList";
import { GuideButton } from "@/components/SizeGuide";
import { getPage } from "@/lib/pages";
export const metadata = { title: "Lens Packages" };
export const dynamic = "force-dynamic";
export default async function Page() {
  // Start the CMS read and the two catalogue reads together. The old version
  // awaited getPage() first, so every lens query waited behind tenant + page
  // resolution before it even started.
  const sb = supabaseFresh();
  const [{ hero }, { data: pkgs }, { data: opts }] = await Promise.all([
    getPage("hero-lenses").then((hero) => ({ hero })),
    sb.from("lens_packages").select("*").eq("status", "active").order("display_order"),
    sb.from("lens_options").select("*").eq("status", "active").order("display_order"),
  ]);
  return (<div className="min-h-screen bg-white overflow-x-hidden"><Header/>
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-10 sm:py-14 px-4 text-center text-white">
      <h1 className="font-display text-2xl sm:text-4xl font-bold">{hero?.title ?? "Lens Packages"}</h1>
      <p className="mt-2 text-sm sm:text-base text-slate-300">{hero?.subtitle ?? "Advanced vision solutions for how you live today"}</p>
    </div>
    <div className="mx-auto max-w-5xl section-pad px-4 space-y-10">
      <div className="flex justify-end"><GuideButton page="lenses" /></div>
      <LensPackageList pkgs={pkgs ?? []} />
      <div className="card p-4 sm:p-6"><h2 className="font-display text-xl sm:text-2xl font-bold text-navy-900 mb-4">Add-Ons &amp; Coatings</h2>
        <div className="grid gap-3 sm:grid-cols-2">{(opts??[]).filter((o:any)=>o.grp==="addon").map((o:any)=>(
          <div key={o.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-slate-200 to-blue-200 flex items-center justify-center">🛡️</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{o.name}{o.badge&&<span className="ml-1 text-[10px] rounded bg-amber-200 px-1.5 text-amber-900">{o.badge}</span>}</p><p className="text-xs text-slate-500 line-clamp-2">{o.description}</p></div>
            <span className="text-sm font-bold text-navy-800 shrink-0 whitespace-nowrap">{Number(o.price)>0?`+${inr(o.price)}`:"Included"}</span>
          </div>))}</div></div>
      <div className="rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 p-6 sm:p-8 text-white text-center">
        <h2 className="font-display text-xl sm:text-2xl font-bold">Not sure which lens is right for you?</h2>
        <p className="mt-2 text-sm sm:text-base text-white/80">Our optometrists will help you choose the perfect lens for your lifestyle and prescription.</p>
        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3"><Link href="/eye-test" className="btn-navy">Book Eye Test</Link><Link href="/help-me-choose" className="btn-outline">Get Expert Advice</Link></div>
      </div>
    </div>
    <Footer/></div>);
}
