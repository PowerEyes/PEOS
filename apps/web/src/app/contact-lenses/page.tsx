import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import Link from "next/link";
import { inr } from "@/lib/types";
import { Breadcrumb } from "@/components/Breadcrumb";
export const revalidate = 60;
export const metadata = { title: "Contact Lenses – Daily, Monthly & Coloured" };
export default async function Page() {
  const sb = supabasePublic();
  const { data: products } = await sb.from("public_catalog").select("*").eq("kind","contact_lens").limit(60);
  const TYPES = [["Daily Disposable","Wear & throw daily. Maximum hygiene.","🟦"],["Monthly","Replace once a month. Economical choice.","🟩"],["Toric","Corrects astigmatism precisely.","🟨"],["Coloured","Change your eye colour.","🟣"],["Multifocal","Progressive correction in a contact lens.","🟤"]];
  return (<div className="min-h-screen bg-white"><Header/>
    <Breadcrumb strip items={[{ label: "Contact Lenses" }]} />
    <div className="bg-gradient-to-r from-teal-900 to-teal-700 py-14 px-4 text-center text-white">
      <h1 className="font-display text-4xl font-bold">Contact Lenses</h1>
      <p className="mt-2 text-teal-200">Daily, monthly and coloured lenses from leading brands</p></div>
    <div className="mx-auto max-w-6xl section-pad px-4 space-y-10">
      {/* Lens types */}
      <div><h2 className="font-display text-2xl font-bold text-navy-900 mb-4">Shop by Type</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{TYPES.map(([l,d,e])=>(
          <button key={l} className="group rounded-2xl border border-slate-100 bg-white p-4 text-left transition hover:border-gold-400 hover:shadow-md">
            <div className="text-2xl mb-2">{e}</div><p className="font-semibold text-sm text-navy-900">{l}</p><p className="text-xs text-slate-500 mt-0.5">{d}</p>
          </button>))}</div></div>
      {/* Key info */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[["📋 Need a Prescription","All prescription contact lenses require a valid contact lens prescription.","Book Eye Test","/eye-test"],["🚚 Fast Dispatch","Same-day dispatch for orders placed before 3 PM.","",""],["🔄 Easy Reorder","Reorder your lenses in two taps once your Rx is saved.","My Reorders","/my/reorder"]].map(([h,d,btn,href]:any)=>(
          <div key={h} className="card p-5 space-y-2"><p className="font-semibold text-navy-900">{h}</p><p className="text-sm text-slate-500">{d}</p>{btn&&<Link href={href} className="btn-gold inline-flex text-sm">{btn}</Link>}</div>))}</div>
      {/* Products */}
      {products?.length ? (<div><h2 className="font-display text-2xl font-bold text-navy-900 mb-4">Our Contact Lenses</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{products.map((p:any)=><ProductCard key={p.id} p={p}/>)}</div></div>)
      : (<div className="card p-10 text-center text-slate-500"><p className="text-lg">Contact lens products coming soon</p><p className="text-sm mt-1">Visit our Mogappair stores for a wide range of contact lenses</p>
          <Link href="/store-locator" className="btn-gold mt-5 inline-flex">Find a Store</Link></div>)}
      {/* Brands */}
      <div className="rounded-2xl bg-navy-50 p-6"><h2 className="font-semibold text-navy-900 mb-3">Brands we carry</h2>
        <div className="flex flex-wrap gap-3">{["Alcon","Johnson & Johnson","Bausch & Lomb","CooperVision","Sauflon","Zeiss"].map(b=><span key={b} className="rounded-full border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800">{b}</span>)}</div></div>
    </div><Footer/></div>);
}
