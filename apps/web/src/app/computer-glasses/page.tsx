
import { supabasePublic } from "@/lib/supabase/server";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { Breadcrumb } from "@/components/Breadcrumb";
import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title:"Computer Glasses & Blue Light Glasses — Power Eyes Opticals",
  description:"Protect your eyes from digital strain with premium computer glasses and blue light blocking lenses. Prescription and non-prescription available at our Mogappair store.",
};
export const revalidate = 300;

const WHY = [
  { e:"🖥️", t:"Reduces Digital Eye Strain", d:"Computer lenses are optimised for the 50–70 cm screen distance, reducing the constant focusing effort that causes end-of-day fatigue." },
  { e:"🔵", t:"Blue Light Filter", d:"Filters high-energy visible blue light emitted by screens. Many customers report improved sleep quality and less eye fatigue." },
  { e:"✨", t:"Anti-Reflective Coating", d:"Eliminates reflections from screens, overhead fluorescents and LED lighting — standard on all computer lenses at Power Eyes." },
  { e:"🔭", t:"Wide Intermediate Zone", d:"Occupational progressives give a wider zone for screen work (50–70 cm) compared to standard progressives — ideal for desk workers with presbyopia." },
];
const TIPS = [
  "Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.",
  "Position your monitor so the top of the screen is at or slightly below eye level.",
  "Reduce overhead glare — position screens perpendicular to windows.",
  "Adjust display brightness to match your surroundings — not brighter, not dimmer.",
  "Computer glasses are not the same as reading glasses — the focal distance is different.",
];

export default async function ComputerGlassesPage() {
  const site = await getSiteSettings();
  const sb = supabasePublic();
  const { data: products } = await sb.from("public_catalog")
    .select("id,brand,model,kind,selling_price,mrp,images,in_stock,attrs,bestseller,new_arrival,power_eligible,sku")
    .or("kind.eq.computer_glasses,attrs->>lens_type.eq.computer,attrs->>usage.eq.computer")
    .order("bestseller",{ascending:false}).order("selling_price").limit(60);

  const hasProducts = (products?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <Breadcrumb strip items={[{ label: "Computer Glasses" }]} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-blue-900 text-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 border border-blue-400/30 px-4 py-1.5 text-blue-300 text-xs font-semibold mb-4">
            🖥️ Digital Eye Care
          </div>
          <h1 className="font-extrabold text-4xl sm:text-5xl leading-tight">Computer &amp; Blue Light<br/>Glasses</h1>
          <p className="mt-4 text-slate-300 text-lg max-w-xl">Protect your eyes from digital strain. Prescription or non-prescription, single vision or occupational progressives — with blue light filter and AR coating built in.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#products" className="rounded-xl bg-gold-500 px-7 py-3.5 font-bold text-sm hover:bg-gold-600 transition">Shop Now →</Link>
            <Link href="/eye-test" className="rounded-xl border-2 border-white/40 px-7 py-3.5 font-semibold text-sm hover:bg-white/10 transition">Free Eye Test</Link>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 text-[300px] flex items-center justify-end pr-8 select-none leading-none">🖥️</div>
      </div>

      {/* Why section */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="font-bold text-2xl text-navy-900 mb-6 text-center">Why Computer Glasses?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {WHY.map(w=>(
            <div key={w.t} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <span className="text-3xl">{w.e}</span>
              <p className="font-bold text-navy-900 mt-3 mb-1 text-sm">{w.t}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{w.d}</p>
            </div>))}
        </div>

        {/* Do you need them? */}
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-6 mb-10">
          <h3 className="font-bold text-navy-900 mb-3">Do you need computer glasses?</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
            {["Eyes feel tired or dry after using screens","Headaches at the end of the work day","Difficulty reading small text on screen","Blurry vision when switching between screen and distance","Neck or shoulder pain from leaning towards the screen","Trouble sleeping after evening screen use"].map(s=>(
              <div key={s} className="flex items-start gap-2"><span className="text-blue-500 mt-0.5 shrink-0">✓</span>{s}</div>))}
          </div>
          <p className="mt-4 text-sm text-slate-500">If you experience 2 or more of the above, a free eye test at our store will confirm whether computer glasses will help.</p>
          <Link href="/eye-test" className="mt-3 inline-flex rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Book Free Eye Test</Link>
        </div>

        {/* Products */}
        <div id="products">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-2xl text-navy-900">Computer Frames &amp; Lenses</h2>
            {!hasProducts && <Link href="/eyeglasses?kind=computer" className="text-sm text-navy-700 hover:underline">See all →</Link>}
          </div>
          {hasProducts
            ? <ProductGrid products={(products ?? []) as any} showRecentlyViewed/>
            : <div className="rounded-2xl bg-white border border-slate-100 p-12 text-center space-y-4">
                <p className="text-3xl">🖥️</p>
                <p className="font-semibold text-slate-600">Computer glasses available in-store</p>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">Our optometrists can help select the right computer lens for your screen distance and usage. Book a free eye test for a personalised recommendation.</p>
                <div className="flex justify-center gap-3">
                  <Link href="/eye-test" className="rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white">Book Eye Test</Link>
                  <Link href="/eyeglasses" className="rounded-lg border border-navy-800 px-6 py-2.5 text-sm font-bold text-navy-800">Browse All Frames</Link>
                </div>
              </div>}
        </div>

        {/* Tips */}
        <div className="mt-10 rounded-2xl bg-navy-50 border border-navy-100 p-6">
          <h3 className="font-bold text-navy-900 mb-3">Expert Eye Care Tips for Screen Users</h3>
          <ul className="space-y-2">{TIPS.map(t=>(
            <li key={t} className="flex items-start gap-2 text-sm text-slate-700"><span className="text-navy-600 font-bold shrink-0">→</span>{t}</li>))}</ul>
          <a href={waHref(site.whatsappNumber, "I need advice about computer glasses")} target="_blank"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-navy-800 px-5 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50 transition">
            💬 Ask our optometrist on WhatsApp
          </a>
        </div>
      </div>
      <Footer/>
    </div>);
}

