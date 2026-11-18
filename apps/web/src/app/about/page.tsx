
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = { title: "About Us – Power Eyes Opticals" };

export default async function AboutPage() {
  const { data: branches } = await supabasePublic().from("branches").select("name,address,phone,email").eq("is_active",true).order("name");

  const MILESTONES = [
    { year:"1998", title:"Founded in Mogappair", desc:"Power Eyes Opticals opened its first store in Mogappair East, Chennai, with a vision to provide expert eye care for every family." },
    { year:"2005", title:"Expanded to 500+ frames", desc:"Grew our collection to include international brands alongside trusted Indian brands — serving every budget." },
    { year:"2012", title:"Digital eye testing introduced", desc:"Invested in advanced auto-refractors and slit lamps to bring clinic-grade eye testing to a retail environment." },
    { year:"2018", title:"Mogappair West branch opened", desc:"To serve the growing Mogappair West community with the same expert care and wide range." },
    { year:"2024", title:"Online store launched", desc:"Launched powereyes.in so families across Chennai and India can shop and book eye tests from home." },
  ];
  const VALUES = [
    { e:"👁️", t:"Expert Eye Care", d:"Every frame sold with professional guidance. Our optometrists are always available — in-store and online." },
    { e:"👨‍👩‍👧", t:"Family First", d:"Since 1998, entire families have trusted us for their vision needs — from children's first glasses to grandparents' progressives." },
    { e:"🎯", t:"Honest Advice", d:"We recommend what's right for your eyes and budget, not what earns us the most margin." },
    { e:"🏅", t:"Genuine Brands Only", d:"100% authentic products from authorised distributors. No grey market, no counterfeits." },
    { e:"🔧", t:"Free Adjustments for Life", d:"Any frame purchased from us gets free adjustments, nose pad replacements and minor repairs — forever." },
    { e:"📋", t:"Prescription Privacy", d:"Your eye prescription and health data is handled with complete confidentiality." },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header/>

      {/* Hero */}
      <div className="relative bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-20 text-center overflow-hidden">
        <div className="relative z-10 mx-auto max-w-2xl">
          <p className="text-gold-400 font-semibold text-sm tracking-widest uppercase mb-3">Since 1998</p>
          <h1 className="font-extrabold text-4xl sm:text-5xl leading-tight">Your Family's<br/>Vision Partner</h1>
          <p className="mt-4 text-slate-300 text-lg">Expert eye care and premium eyewear for every generation in Mogappair, Chennai.</p>
          <Link href="/eye-test" className="mt-6 inline-flex rounded-lg bg-gold-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-gold-600 transition">Book a Free Eye Test →</Link>
        </div>
        <div className="absolute inset-0 opacity-5 text-[200px] flex items-center justify-center select-none">👁</div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 space-y-16">
        {/* Story */}
        <div className="grid gap-10 sm:grid-cols-2 items-center">
          <div>
            <p className="text-gold-500 font-semibold text-sm uppercase tracking-wider mb-2">Our Story</p>
            <h2 className="font-bold text-3xl text-navy-900 mb-4">26 years of clearer vision</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>Power Eyes Opticals started in 1998 as a small optical shop in Mogappair East, Chennai, with a single purpose: to make quality eye care and genuine eyewear accessible to every family in the neighbourhood.</p>
              <p>What began as a modest dispensary has grown into Mogappair's most trusted optical destination — with two stores, a full range of international and Indian brands, advanced digital eye testing equipment, and a team of trained optometrists who treat every customer like family.</p>
              <p>Today, thousands of families across Chennai trust Power Eyes for their prescription glasses, contact lenses, children's eyewear and expert eye care guidance. We remain independently owned and deeply rooted in the community we've served for over two decades.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["2+","Stores in Mogappair"],["10,000+","Families served"],["500+","Frames in store"],["26","Years of trust"]].map(([n,l])=>(
              <div key={l} className="rounded-2xl bg-navy-50 border border-navy-100 p-5 text-center">
                <p className="font-extrabold text-3xl text-navy-900">{n}</p>
                <p className="text-xs text-slate-500 mt-1">{l}</p>
              </div>))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-8 text-center">Our Journey</h2>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200 hidden sm:block"/>
            <div className="space-y-6">
              {MILESTONES.map(m=>(
                <div key={m.year} className="flex gap-5 items-start">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-navy-800 text-white text-xs font-bold text-center leading-tight z-10">{m.year}</div>
                  <div className="flex-1 rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                    <p className="font-bold text-navy-900">{m.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{m.desc}</p>
                  </div>
                </div>))}
            </div>
          </div>
        </div>

        {/* Values */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-2 text-center">What We Stand For</h2>
          <p className="text-slate-500 text-center mb-8">The principles that guide every decision we make.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(v=>(
              <div key={v.t} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <div className="text-3xl mb-3">{v.e}</div>
                <p className="font-bold text-navy-900 mb-1">{v.t}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{v.d}</p>
              </div>))}
          </div>
        </div>

        {/* Stores */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-2 text-center">Visit Our Stores</h2>
          <p className="text-slate-500 text-center mb-8">Both stores offer full eye testing, frame selection and expert dispensing.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(branches||[]).map((b:any)=>(
              <div key={b.name} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <div className="h-32 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-4xl mb-4">🏪</div>
                <p className="font-bold text-navy-900">{b.name}</p>
                <p className="text-sm text-slate-600 mt-1">📍 {b.address}</p>
                <p className="text-sm text-slate-600 mt-0.5">📞 {b.phone}</p>
                {b.email&&<p className="text-sm text-slate-600 mt-0.5">✉️ {b.email}</p>}
                <p className="text-xs text-slate-400 mt-1">🕐 Mon–Sun: 10:00 AM – 9:00 PM</p>
                <div className="flex gap-2 mt-3">
                  <Link href="/eye-test" className="flex-1 rounded-lg bg-navy-800 py-2 text-xs font-bold text-white text-center hover:bg-navy-700">Book Eye Test</Link>
                  <Link href="/store-locator" className="flex-1 rounded-lg border border-navy-800 py-2 text-xs font-bold text-navy-800 text-center hover:bg-navy-50">Directions</Link>
                </div>
              </div>))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 p-10 text-white text-center">
          <h2 className="font-bold text-2xl mb-2">Ready for clearer vision?</h2>
          <p className="text-white/80 mb-6">Book a free professional eye test at our Mogappair store.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/eye-test" className="rounded-lg bg-white px-7 py-3 text-sm font-bold text-navy-900 hover:bg-slate-100 transition">Book Eye Test →</Link>
            <Link href="/eyeglasses" className="rounded-lg border-2 border-white px-7 py-3 text-sm font-bold text-white hover:bg-white hover:text-navy-900 transition">Shop Eyewear</Link>
          </div>
        </div>
      </div>
      <Footer/>
    </div>);
}

