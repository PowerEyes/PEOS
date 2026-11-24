"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { LensConfigurator } from "@/components/LensConfigurator";
import { imgUrl, inr, disc, type Product } from "@/lib/types";
import { Heart, Share2, Star, ShoppingBag, MessageCircle, ChevronRight, RotateCcw, Shield, Truck, Wrench, Info } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";

const TABS = ["Description","Fit & Size","Features","What's Included","Reviews","Similar Products","FAQ"] as const;

function StarBar({ pct, count }: { pct: number; count: number }) {
  return <div className="flex items-center gap-2 text-xs"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold-500 transition-all" style={{width:`${pct}%`}}/></div><span className="w-4 text-right text-slate-500">{count}</span></div>;
}

export function ProductDetail({ product: p, reviews, summary, similar }: { product: Product; reviews: any[]; summary: any; similar: Product[] }) {
  const { whatsappNumber } = useSite();
  const [imgIdx, setImgIdx] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Description");
  const [withLens, setWithLens] = useState(p.power_eligible);
  const [liked, setLiked] = useState(false);
  const [configuratorOpen, setConfiguratorOpen] = useState(false);
  const d = disc(p.mrp, p.selling_price);
  const imgs = p.images?.length ? p.images : [];
  const mainImg = imgs[imgIdx] ? imgUrl(imgs[imgIdx]) : null;
  const attrs = p.attrs ?? {};
  const tot = summary?.total_reviews ?? 0;
  const avg = summary?.avg_rating ?? 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Breadcrumb */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:px-6">
        <span>Home</span><ChevronRight size={12} className="inline mx-1"/><span className="capitalize">{p.kind === "frame" ? "Eyeglasses" : p.kind}</span>
        {p.brand && <><ChevronRight size={12} className="inline mx-1"/><span>{p.brand}</span></>}
        <ChevronRight size={12} className="inline mx-1"/><span className="text-slate-700 font-medium">{p.model}</span>
      </div>

      {/* Main grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">

          {/* ── Gallery ── */}
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-white aspect-square flex items-center justify-center border border-slate-100">
              <AnimatePresence mode="wait">
                {mainImg
                  ? <motion.img key={imgIdx} src={mainImg} alt={`${p.brand} ${p.model}`} className="max-h-full max-w-full object-contain p-8" initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:.2}}/>
                  : <div className="text-8xl select-none">👓</div>}
              </AnimatePresence>
              {d && <span className="absolute left-4 top-4 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">{d}% OFF</span>}
              {p.bestseller && <span className="absolute right-4 top-4 rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-white">Best Seller</span>}
              <div className="absolute bottom-4 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 shadow-sm"><RotateCcw size={12}/> 360° View</span>
              </div>
            </div>
            {/* Thumbnails */}
            {imgs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imgs.map((im, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition ${imgIdx === i ? "border-navy-700" : "border-slate-100"}`}>
                    <img src={imgUrl(im)!} alt="" className="h-full w-full object-contain p-1"/>
                  </button>))}
              </div>)}
            {/* Virtual try-on strip */}
            <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-800 p-4 flex items-center justify-between text-white">
              <div><p className="font-semibold text-sm">See it on You</p><p className="text-xs text-slate-300">Try this frame virtually</p></div>
              <button className="rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition">Start Virtual Try-On →</button>
            </div>
          </div>

          {/* ── Product Info ── */}
          <div className="space-y-5">
            <div>
              {p.brand && <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{p.brand}</p>}
              <h1 className="font-display text-3xl font-bold text-navy-900 mt-1">{p.model}</h1>
              {p.short_desc && <p className="text-slate-500 mt-1">{p.short_desc}</p>}
            </div>

            {/* Rating */}
            {tot > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">{[1,2,3,4,5].map(s=><Star key={s} size={16} className={s<=Math.round(avg)?"fill-gold-500 text-gold-500":"text-slate-200"}/>)}</div>
                <span className="text-sm font-semibold">{avg}</span>
                <span className="text-sm text-slate-500">({tot} reviews)</span>
                <button onClick={()=>setTab("Reviews")} className="text-sm text-navy-700 underline">Write a review</button>
              </div>)}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-navy-900">{inr(p.selling_price)}</span>
              {p.mrp && p.mrp > p.selling_price && <><span className="text-xl text-slate-400 line-through">{inr(p.mrp)}</span><span className="rounded-full bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-600">{d}% OFF</span></>}
            </div>
            <p className="text-xs text-slate-500">Inclusive of all taxes &nbsp;·&nbsp; SKU: {p.sku}</p>

            {/* Colours */}
            {attrs.color && <div><p className="text-sm font-semibold text-slate-700 mb-2">Colour: {attrs.color}</p>
              <div className="flex gap-2"><span className="h-8 w-8 rounded-full bg-amber-800 ring-2 ring-navy-700 ring-offset-2"/></div></div>}

            {/* Size */}
            {attrs.size && <div><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">Size: {attrs.size}</p><button className="text-xs text-navy-700 underline flex items-center gap-1"><Info size={12}/>Size Guide</button></div>
              <div className="mt-2 flex gap-2">{["Small","Medium","Large"].map(sz=><button key={sz} className={`rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${sz===attrs.size?"border-navy-800 bg-navy-800 text-white":"border-slate-200 hover:border-navy-700"}`}>{sz}</button>)}</div></div>}

            {/* With Lenses toggle */}
            {p.power_eligible && (
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-1">
                {[{v:true,l:"With Lenses",sub:"Complete glasses with your prescription"},{v:false,l:"Frame Only",sub:"Buy frame only"}].map(o=>(
                  <button key={String(o.v)} onClick={()=>setWithLens(o.v)} className={`rounded-xl p-3 text-left transition ${withLens===o.v?"bg-white shadow-sm ring-2 ring-navy-700":""}`}>
                    <p className="text-sm font-semibold">{o.l}</p><p className="text-xs text-slate-500">{o.sub}</p>
                  </button>))}</div>)}

            {/* CTAs */}
            <div className="flex gap-3">
              {p.power_eligible && withLens
                ? <button onClick={()=>setConfiguratorOpen(true)} className="btn-gold flex-1 py-4 text-base">Choose Lenses →</button>
                : <button className="btn-navy flex-1 py-4 text-base"><ShoppingBag size={18}/>Add to Bag</button>}
              <button onClick={()=>setLiked(!liked)} className={`grid h-14 w-14 place-items-center rounded-full border-2 transition ${liked?"border-rose-400 bg-rose-50":"border-slate-200 hover:border-slate-400"}`}>
                <Heart size={20} className={liked?"fill-rose-500 text-rose-500":"text-slate-500"}/>
              </button>
              <button className="grid h-14 w-14 place-items-center rounded-full border-2 border-slate-200 hover:border-slate-400 transition">
                <Share2 size={18} className="text-slate-500"/>
              </button>
            </div>

            {/* Store availability */}
            <div className="rounded-2xl border border-slate-100 p-4 space-y-2 text-sm">
              <p className="font-semibold text-slate-700">Available at your nearest store</p>
              {["Mogappair East","Mogappair West"].map(s=>(
                <div key={s} className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-600">📍 {s}</span><span className="text-emerald-600 font-medium">{p.in_stock?"In Stock":"Check in store"}</span></div>))}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
              {[[Shield,"100% Authentic"],[Info,"Prescription Compatible"],[Wrench,"Free Adjustments"],[Truck,"1 Year Warranty"]].map(([I,t]:any)=>(
                <div key={t} className="flex items-center gap-2"><I size={14} className="text-gold-500 shrink-0"/>{t}</div>))}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-12">
          <div className="flex gap-0 overflow-x-auto border-b border-slate-200">
            {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition ${tab===t?"border-b-2 border-navy-800 text-navy-900":"text-slate-500 hover:text-slate-700"}`}>{t}{t==="Reviews"&&tot>0?` (${tot})`:""}</button>)}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.18}} className="py-8">
              {tab==="Description"&&<div className="max-w-2xl space-y-4"><p className="text-slate-600 leading-relaxed">{p.description||`The ${p.brand??""} ${p.model} combines quality craftsmanship with everyday versatility. Perfect for any face shape and suitable for prescription lenses.`}</p>
                <ul className="space-y-2">{["Lightweight & durable","Universal bridge fit","Suitable for men & women","Perfect for everyday wear"].map(f=><li key={f} className="flex items-center gap-2 text-sm text-slate-700"><span className="text-gold-500">✓</span>{f}</li>)}</ul></div>}
              {tab==="Fit & Size"&&<div className="max-w-xl space-y-4"><p className="text-sm text-slate-500">Frame measurements help you find the right size.</p>
                <div className="grid grid-cols-5 gap-3">{[["Lens Width",attrs.lens_width,"mm"],["Bridge",attrs.bridge,"mm"],["Temple Arm",attrs.temple,"mm"],["Lens Height",attrs.lens_height,"mm"],["Frame Width",attrs.frame_width,"mm"]].map(([l,v,u])=>(
                  <div key={l as string} className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-bold text-navy-900">{v||"—"}{v?u:""}</p><p className="text-[10px] text-slate-500 mt-1">{l as string}</p></div>))}</div></div>}
              {tab==="Reviews"&&<div className="space-y-6">
                {tot > 0 && <div className="flex gap-8 items-start"><div className="text-center"><p className="text-7xl font-bold text-navy-900">{avg}</p><div className="flex justify-center mt-1">{[1,2,3,4,5].map(s=><Star key={s} size={18} className={s<=Math.round(avg)?"fill-gold-500 text-gold-500":"text-slate-200"}/>)}</div><p className="text-sm text-slate-500 mt-1">Based on {tot} reviews</p></div>
                  <div className="flex-1 space-y-1.5">{[5,4,3,2,1].map(r=><div key={r} className="flex items-center gap-2"><span className="text-xs text-slate-500 w-4">{r}</span><Star size={11} className="fill-gold-400 text-gold-400"/><StarBar pct={tot?Math.round((summary?.[`r${r}`]??0)/tot*100):0} count={summary?.[`r${r}`]??0}/></div>)}</div></div>}
                <div className="space-y-4">{reviews.map((r,i)=>(
                  <div key={i} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="font-semibold text-sm">{r.reviewer_name}</span>{r.verified_purchase&&<span className="text-[10px] text-emerald-600 font-semibold">✓ Verified</span>}</div>
                    <div className="flex">{[1,2,3,4,5].map(s=><Star key={s} size={13} className={s<=r.rating?"fill-gold-500 text-gold-500":"text-slate-200"}/>)}</div></div>
                  {r.title&&<p className="font-semibold text-sm mt-2">{r.title}</p>}<p className="text-sm text-slate-600 mt-1">{r.body}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(r.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p></div>))}
                  {tot===0&&<p className="text-slate-500">No reviews yet. Be the first to review this product.</p>}</div></div>}
              {tab==="Similar Products"&&similar.length>0&&<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{similar.map(s=><ProductCard key={s.id} p={s}/>)}</div>}
              {!["Description","Fit & Size","Reviews","Similar Products"].includes(tab)&&<p className="text-slate-500">Information coming soon.</p>}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* You Might Also Like */}
        {similar.length>0&&<div className="mt-4 border-t border-slate-100 pt-10">
          <div className="flex items-end justify-between mb-5"><h2 className="font-display text-2xl font-bold text-navy-900">You Might Also Like</h2><Link href="/eyeglasses" className="text-sm font-semibold text-navy-700 hover:underline flex items-center gap-1">View All <ChevronRight size={14}/></Link></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{similar.map(s=><ProductCard key={s.id} p={s}/>)}</div>
        </div>}
      </div>

      {/* Sticky bottom on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white p-3 sm:hidden">
        <div className="flex gap-3">
          {p.power_eligible ? <button onClick={()=>setConfiguratorOpen(true)} className="btn-gold flex-1">Choose Lenses →</button> : <button className="btn-navy flex-1">Add to Bag</button>}
          <a href={waHref(whatsappNumber)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><MessageCircle size={20}/></a>
        </div>
      </div>

      <LensConfigurator open={configuratorOpen} onClose={()=>setConfiguratorOpen(false)} product={p}/>
      <Footer/>
    </div>
  );
}

// Need Link for similar products
import Link from "next/link";
