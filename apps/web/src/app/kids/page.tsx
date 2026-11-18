
import { supabasePublic } from "@/lib/supabase/server";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { Breadcrumb } from "@/components/Breadcrumb";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title:"Kids Eyewear & Children's Glasses — Power Eyes Opticals",
  description:"Safe, durable and stylish glasses for children. Impact-resistant lenses, flexible frames and free eye tests for kids at our Mogappair store.",
};
export const revalidate = 300;

const AGES = [
  { range:"3–6 years",  label:"Pre-School",   desc:"Flexible hinges, soft nose pads, unbreakable TR90 frames" },
  { range:"6–10 years", label:"Primary",       desc:"Spring hinges, wide bridge, comes with warranty" },
  { range:"10–14 years",label:"Middle School", desc:"Teen styles, thinner lenses, premium brands" },
  { range:"14–17 years",label:"Teenage",       desc:"Full adult frame styles with youth sizing" },
];
const SAFETY = [
  { e:"🛡️", t:"Impact Resistant",         d:"Polycarbonate or Trivex lenses are 10× stronger than standard plastic — mandatory for children below 16." },
  { e:"🔧", t:"Flexible Frames",           d:"TR90 and memory metal frames bend without breaking — ideal for active children." },
  { e:"🔵", t:"Blue Light Filter",         d:"Recommended for school children who use tablets and computers for homework." },
  { e:"🎨", t:"Fun Designs",               d:"Bright colours, cartoon characters and patterns that children actually want to wear." },
  { e:"⚙️", t:"Spring Hinges",             d:"Hinges that flex outward reduce stress on the frame when children inevitably grab and bend them." },
  { e:"📋", t:"Free Kids Eye Test",        d:"Comprehensive children's eye test, free of charge, recommended annually from age 3." },
];

export default async function KidsPage() {
  const sb = supabasePublic();
  const { data: products } = await sb.from("public_catalog")
    .select("id,brand,model,kind,selling_price,mrp,images,in_stock,attrs,bestseller,new_arrival,power_eligible,sku")
    .or("attrs->>gender.eq.kids,attrs->>gender.eq.children,attrs->>age_group.eq.kids")
    .order("bestseller",{ascending:false}).order("selling_price").limit(60);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <Breadcrumb strip items={[{ label: "Kids Eyewear" }]} />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-navy-900 text-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-white text-xs font-semibold mb-4">
            👶 Safe &amp; Fun Eyewear for Children
          </div>
          <h1 className="font-extrabold text-4xl sm:text-5xl leading-tight">Kids Eyewear</h1>
          <p className="mt-4 text-slate-200 text-lg max-w-xl">Impact-resistant lenses, flexible frames and styles children love. Free eye tests for all ages — walk-in or book online.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="#products" className="rounded-xl bg-gold-500 px-7 py-3.5 font-bold text-sm hover:bg-gold-600 transition">Shop Kids Frames →</Link>
            <Link href="/eye-test" className="rounded-xl border-2 border-white/40 px-7 py-3.5 font-semibold text-sm hover:bg-white/10 transition">Free Kids Eye Test</Link>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 text-emerald-200 text-xs">
            ✓ Free comprehensive eye test for children below 16 · No appointment needed
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 text-[280px] flex items-center justify-end pr-6 select-none leading-none">👶</div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-10">
        {/* Age groups */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-5 text-center">Frames by Age Group</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {AGES.map(a=>(
              <Link key={a.range} href={`/eyeglasses?gender=kids&age_group=${encodeURIComponent(a.range)}`}
                className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 text-center hover:border-blue-300 hover:shadow-md transition">
                <p className="font-extrabold text-2xl text-navy-900">{a.range}</p>
                <p className="font-semibold text-sm text-blue-700 mt-1">{a.label}</p>
                <p className="text-xs text-slate-500 mt-1">{a.desc}</p>
              </Link>))}
          </div>
        </div>

        {/* Safety first */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-2 text-center">Safety First</h2>
          <p className="text-slate-500 text-sm text-center mb-5">Every kids frame at Power Eyes is sold with these standards — no exceptions.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map(s=>(
              <div key={s.t} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <span className="text-2xl">{s.e}</span>
                <p className="font-bold text-navy-900 mt-2 mb-1 text-sm">{s.t}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{s.d}</p>
              </div>))}
          </div>
        </div>

        {/* Eye test for kids */}
        <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-7 text-white">
          <div className="grid gap-5 sm:grid-cols-2 items-center">
            <div>
              <p className="font-extrabold text-2xl mb-2">When should your child get an eye test?</p>
              <ul className="space-y-1.5 text-slate-300 text-sm">
                {["First test at age 3–4 before starting school","Then annually through school years","Immediately if they squint, sit close to TV, or complain of headaches","Annual tests recommended for children already wearing glasses"].map(t=>(
                  <li key={t} className="flex items-start gap-2"><span className="text-gold-400 mt-0.5 shrink-0">✓</span>{t}</li>))}
              </ul>
              <Link href="/eye-test" className="mt-4 inline-flex rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-gold-600 transition">Book Free Kids Eye Test →</Link>
            </div>
            <div className="rounded-xl bg-white/10 p-5 text-sm">
              <p className="font-bold text-gold-400 mb-2">Signs your child may need glasses</p>
              {["Sitting too close to the TV or screen","Squinting or tilting their head to see","Frequent headaches, especially after reading","Losing their place while reading","Rubbing eyes excessively","One eye turns in or out"].map(s=>(
                <p key={s} className="flex items-center gap-1.5 text-slate-300 mb-1"><span className="text-rose-400">●</span>{s}</p>))}
            </div>
          </div>
        </div>

        {/* Products */}
        <div id="products">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-2xl text-navy-900">Kids Frames</h2>
            <Link href="/eyeglasses?gender=kids" className="text-sm text-navy-700 hover:underline">View all →</Link>
          </div>
          {(products?.length ?? 0) > 0
            ? <ProductGrid products={(products ?? []) as any} showRecentlyViewed/>
            : <div className="rounded-2xl bg-white border border-slate-100 p-12 text-center space-y-4">
                <p className="text-4xl">👶</p>
                <p className="font-semibold text-slate-600">Wide range of kids frames available in-store</p>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">Visit our Mogappair East store to see our full range of children's eyewear. Walk-in and free eye test available daily 10 AM – 9 PM.</p>
                <div className="flex justify-center gap-3">
                  <Link href="/eye-test" className="rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white">Book Eye Test</Link>
                  <Link href="/store-locator" className="rounded-lg border border-navy-800 px-6 py-2.5 text-sm font-bold text-navy-800">Find Our Store</Link>
                </div>
              </div>}
        </div>
      </div>
      <Footer/>
    </div>);
}

