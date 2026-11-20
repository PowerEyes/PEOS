"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useToast } from "@poweros/ui";
import { disc, imgUrl, inr, type Product } from "@/lib/types";
import { useWishlist } from "@/lib/wishlist";
import { SizeGuide } from "./SizeGuide";

export function ProductCard({ p }: { p: Product }) {
  const [img,setImg]=useState(0);
  const toast = useToast();
  const { has, toggle } = useWishlist();
  const liked = has(p.id);
  const d=disc(p.mrp,p.selling_price); const url=imgUrl(p.images?.[img]);
  // Urgency labels (migration 0022 adds these columns; hidden until then).
  const stock = typeof p.stock_qty === "number" ? p.stock_qty : null;
  const views = typeof p.today_views === "number" ? p.today_views : null;
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type:"spring",damping:20,stiffness:300 }} className="group relative flex flex-col bg-white rounded-2xl shadow-[0_2px_8px_rgba(10,34,64,.08)] overflow-hidden">
      <a href={`/product/${p.id}`} target="_blank" rel="noopener" className="block" aria-label={`${p.brand} ${p.model} – opens in new tab`}>
        <div className="relative bg-gradient-to-br from-slate-50 to-white aspect-[4/3] overflow-hidden">
          {url ? <img src={url} alt={`${p.brand} ${p.model}`} className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105" loading="lazy" />
            : <div className="flex h-full items-center justify-center"><span className="text-slate-300 text-4xl">👓</span></div>}
          {/* Badges on top-left (stacked, no collision with wishlist) */}
          <div className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 z-10 flex flex-col gap-1 items-start pointer-events-none">
            {d && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-sm">{d}% OFF</span>}
            {p.new_arrival && <span className="rounded-full bg-navy-900 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white shadow-sm">New</span>}
          </div>
          {/* Image dots */}
          {p.images.length>1&&<div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition">{p.images.slice(0,4).map((_,i)=><button key={i} onClick={e=>{e.preventDefault();setImg(i);}} className={`h-1.5 w-1.5 rounded-full transition ${i===img?"bg-navy-800":"bg-slate-300"}`}/>)}</div>}
        </div>
      </a>
      <button onClick={()=>{ toggle(p.id); toast(liked ? "Removed from wishlist" : "Saved to wishlist"); }} className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white shadow-md transition hover:scale-110 active:scale-95" aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}>
        <Heart size={15} className={liked?"fill-rose-500 text-rose-500":"text-slate-400"}/>
      </button>
      <div className="flex flex-col flex-1 p-3">
        <p className="text-xs text-slate-500 truncate">{p.brand}</p>
        <p className="font-semibold text-sm leading-tight truncate">{p.model}</p>
        <div className="mt-1 flex items-center gap-2"><span className="font-bold">{inr(p.selling_price)}</span>{p.mrp&&p.mrp>p.selling_price&&<span className="text-xs text-slate-400 line-through">{inr(p.mrp)}</span>}</div>
        {!p.in_stock&&<p className="mt-1 text-xs text-rose-500 font-medium">Out of stock</p>}
        {p.in_stock && stock !== null && stock <= 3 && <p className="mt-1 text-xs font-semibold text-amber-600">⚡ Only {stock} left in stock</p>}
        {views !== null && views >= 3 && <p className="mt-1 text-[11px] text-slate-500">👁 {views} people viewed this today</p>}
                <SizeGuide label="Size guide" className="mt-1.5 self-start text-[11px] text-slate-400 underline decoration-slate-300 underline-offset-2 transition hover:text-navy-700 py-0.5 min-h-[44px] flex items-center" />
        {p.power_eligible
          ? <a href={`/product/${p.id}`} target="_blank" rel="noopener" className="mt-3 w-full rounded-full bg-gold-500 py-2.5 px-3 text-center text-xs font-semibold text-white hover:bg-gold-600 transition min-h-[44px] flex items-center justify-center">Choose Lenses →</a>
          : <button onClick={(e)=>{ e.preventDefault(); const cart=JSON.parse(localStorage.getItem("pe_cart_v3")??"[]"); const ex=cart.find((c:any)=>c.productId===p.id); if(ex){ex.qty=(ex.qty??1)+1;localStorage.setItem("pe_cart_v3",JSON.stringify(cart));} else { cart.push({id:Math.random().toString(36).slice(2),productId:p.id,productName:`${p.brand??""} ${p.model}`.trim(),brand:p.brand,image:p.images?.[0],framePrice:Number(p.selling_price),lensTotal:0,total:Number(p.selling_price),qty:1,power_eligible:false}); localStorage.setItem("pe_cart_v3",JSON.stringify(cart)); } window.dispatchEvent(new Event("pe_cart_update")); toast("Added to bag"); }} className="mt-3 w-full rounded-full border border-navy-800 py-2.5 px-3 text-center text-xs font-semibold text-navy-800 hover:bg-navy-800 hover:text-white transition min-h-[38px] flex items-center justify-center">Add to Bag</button>}
      </div>
    </motion.div>);
}
