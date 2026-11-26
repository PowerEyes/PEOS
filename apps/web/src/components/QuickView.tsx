
"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Heart, Star, ChevronRight, ExternalLink } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { useToast } from "@poweros/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LensConfigurator } from "./LensConfigurator";
import { imgUrl, inr, disc } from "@/lib/types";

type Props = { productId: string | null; onClose: () => void };

export function QuickView({ productId, onClose }: Props) {
  const { storeName } = useSite();
  const [product, setProduct] = useState<any>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [configuratorOpen, setConfiguratorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!productId) { setProduct(null); return; }
    setLoading(true); setImgIdx(0);
    supabaseBrowser().from("public_catalog").select("*").eq("id", productId).single()
      .then(({ data }) => { setProduct(data); setLoading(false); });
  }, [productId]);

  const d = product ? disc(product.mrp, product.selling_price) : null;

  return (
    <AnimatePresence>
      {productId && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/50" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/>
          <motion.div
            className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
            initial={{ x: 520 }} animate={{ x: 0 }} exit={{ x: 520 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <p className="font-bold text-navy-900">Quick View</p>
              <div className="flex items-center gap-2">
                {product && (
                  <a href={`/product/${product.id}`} rel="noopener"
                    className="flex items-center gap-1.5 text-xs text-navy-700 font-semibold hover:underline">
                    Full details <ExternalLink size={12}/>
                  </a>)}
                <button onClick={onClose} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16}/></button>
              </div>
            </div>

            {loading && <div className="flex-1 flex items-center justify-center text-slate-400">Loading…</div>}

            {product && !loading && (
              <div className="flex-1 overflow-y-auto">
                {/* Image gallery */}
                <div className="relative bg-gradient-to-br from-slate-50 to-white aspect-square flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {product.images?.[imgIdx]
                      ? <motion.img key={imgIdx} src={imgUrl(product.images[imgIdx])!} alt={product.model}
                          className="max-h-72 max-w-full object-contain p-6"
                          initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}/>
                      : <span className="text-8xl">👓</span>}
                  </AnimatePresence>
                  {d && <span className="absolute left-4 top-4 rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white">{d}% OFF</span>}
                  {product.bestseller && <span className="absolute right-4 top-4 rounded-full bg-gold-500 px-2.5 py-0.5 text-[11px] font-bold text-white">Best Seller</span>}
                  <button onClick={() => setLiked(l => !l)} className="absolute right-4 bottom-4 grid h-9 w-9 place-items-center rounded-full bg-white shadow-md hover:scale-110 transition">
                    <Heart size={16} className={liked ? "fill-rose-500 text-rose-500" : "text-slate-400"}/>
                  </button>
                </div>
                {/* Thumbnails */}
                {product.images?.length > 1 && (
                  <div className="flex gap-2 px-5 py-3 overflow-x-auto">
                    {product.images.map((im: string, i: number) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        className={`h-14 w-14 shrink-0 rounded-lg border-2 overflow-hidden transition ${imgIdx===i?"border-navy-700":"border-slate-100"}`}>
                        <img src={imgUrl(im)!} alt="" className="h-full w-full object-contain p-1"/>
                      </button>))}
                  </div>)}

                {/* Product info */}
                <div className="px-5 pb-6 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{product.brand}</p>
                    <h2 className="font-bold text-xl text-navy-900 mt-0.5">{product.model}</h2>
                    {product.short_desc && <p className="text-sm text-slate-500 mt-1">{product.short_desc}</p>}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-navy-900">{inr(product.selling_price)}</span>
                    {d && <span className="text-lg text-slate-400 line-through">{inr(product.mrp)}</span>}
                    {d && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">{d}% OFF</span>}
                  </div>
                  {/* Availability */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${product.in_stock?"bg-emerald-500":"bg-rose-500"}`}/>
                    <span className={product.in_stock ? "text-emerald-700" : "text-rose-600"}>
                      {product.in_stock ? `In stock at ${storeName || "store"}` : "Currently out of stock"}
                    </span>
                  </div>
                  {/* Features */}
                  {product.attrs && Object.keys(product.attrs).length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {product.attrs.material && <span>Material: <b>{product.attrs.material}</b></span>}
                      {product.attrs.shape && <span>Shape: <b>{product.attrs.shape}</b></span>}
                      {product.attrs.gender && <span>For: <b className="capitalize">{product.attrs.gender}</b></span>}
                      {product.attrs.size && <span>Size: <b>{product.attrs.size}</b></span>}
                    </div>)}
                  {/* CTAs */}
                  <div className="space-y-3">
                    {product.power_eligible
                      ? <button onClick={() => setConfiguratorOpen(true)}
                          className="w-full rounded-xl bg-gold-500 py-4 text-sm font-bold text-white hover:bg-gold-600 transition">
                          Choose Lenses →
                        </button>
                      : <button onClick={() => {
                          const item = { id:Math.random().toString(36).slice(2), productId:product.id, name:`${product.brand} ${product.model}`, brand:product.brand, image:product.images?.[0], framePrice:Number(product.selling_price), lensTotal:0, total:Number(product.selling_price), qty:1, power_eligible:false };
                          try{ const c=JSON.parse(localStorage.getItem("pe_cart_v3")??"[]"); localStorage.setItem("pe_cart_v3",JSON.stringify([...c,item])); window.dispatchEvent(new Event("pe_cart_update")); }catch{}
                          toast("Added to bag"); onClose();
                        }} className="w-full rounded-xl bg-navy-800 py-4 text-sm font-bold text-white hover:bg-navy-700 transition">
                          Add to Bag
                        </button>}
                    <a href={`/product/${product.id}`} rel="noopener"
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:border-navy-700 hover:text-navy-800 transition">
                      View Full Details <ChevronRight size={15}/>
                    </a>
                  </div>
                </div>
              </div>)}
          </motion.div>
          <LensConfigurator open={configuratorOpen} onClose={() => setConfiguratorOpen(false)} product={product}/>
        </div>)}
    </AnimatePresence>);
}
