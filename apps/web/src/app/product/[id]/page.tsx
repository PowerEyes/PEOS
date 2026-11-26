
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useToast } from "@poweros/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { trackView } from "@/components/RecentlyViewed";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { ReviewForm } from "@/components/ReviewForm";
import { LensConfigurator } from "@/components/LensConfigurator";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Lightbox } from "@/components/Lightbox";
import { ProductPageSkeleton } from "@/components/Skeletons";
import { SizeGuide } from "@/components/SizeGuide";
import { useWishlist } from "@/lib/wishlist";
import { Star, Heart, X } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type Params = { params: { id: string } };

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={14} className={n<=Math.round(rating)?"fill-gold-500 text-gold-500":"text-slate-200"}/>))}
      <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      <span className="text-sm text-slate-400">({count} reviews)</span>
    </div>);
}

export default function ProductPage({ params }: Params) {
  const { id } = params;
  const { whatsappNumber, storeName } = useSite();
  const [product,  setProduct]  = useState<any>(null);
  const [reviews,  setReviews]  = useState<any[]>([]);
  const [related,  setRelated]  = useState<any[]>([]);
  const [imgIdx,   setImgIdx]   = useState(0);
  const [tab,      setTab]      = useState("desc");
  const [confOpen, setConfOpen] = useState(false);
  const [revOpen,  setRevOpen]  = useState(false);  // ← ReviewForm modal
  const [lb,       setLb]       = useState(false);  // image lightbox
  const [showBar,  setShowBar]  = useState(false);  // sticky add-to-cart bar
  const toast = useToast();
  const router = useRouter();
  const ctaRef = useRef<HTMLDivElement>(null);
  // Heart syncs across sessions (Supabase for signed-in, localStorage for guests).
  const { has, toggle } = useWishlist();
  const liked = has(id);

  // Sticky bar: visible only after the main CTAs scroll out above the viewport.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const imgUrl = (img?: string) => img ? `${SB_URL}/storage/v1/object/public/product-images/${img}` : null;
  const inr    = (n: any) => `₹${Number(n||0).toLocaleString("en-IN")}`;
  const disc   = (m: any, s: any) => m && s && m > s ? Math.round((m-s)/m*100) : 0;

  useEffect(() => {
    if (!id) return;
    // Track view immediately
    trackView(id);

    const sb = supabaseBrowser();
    // Load product
    sb.from("public_catalog").select("*").eq("id",id).single()
      .then(({ data }) => setProduct(data));
    // Load approved reviews
    sb.from("product_reviews").select("id,reviewer_name,rating,title,body,verified_purchase,created_at")
      .eq("product_id",id).eq("status","approved").order("created_at",{ascending:false}).limit(20)
      .then(({ data }) => setReviews(data ?? []));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    // Load related products
    supabaseBrowser().from("public_catalog").select("id,brand,model,selling_price,images")
      .eq("kind", product.kind).neq("id", id).limit(6)
      .then(({ data }) => setRelated(data ?? []));
  }, [product]);

  if (!product) return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Same shell as the loaded page — detail.tsx renders <Header/> too */}
      <Header />
      <ProductPageSkeleton />
      <Footer/>
    </div>);

  const d = disc(product.mrp, product.selling_price);
  const avgRating = reviews.length ? reviews.reduce((a,r)=>a+r.rating,0)/reviews.length : 0;
  const url = imgUrl(product.images?.[imgIdx]);

  // Breadcrumb: Home › kind › brand › model
  const KIND_CRUMB: Record<string, { label: string; href?: string }> = {
    frame: { label: "Eyeglasses", href: "/eyeglasses" },
    sunglass: { label: "Sunglasses", href: "/sunglasses" },
    contact_lens: { label: "Contact Lenses", href: "/contact-lenses" },
    computer_glasses: { label: "Computer Glasses", href: "/computer-glasses" },
  };
  const kindC = KIND_CRUMB[product.kind] ?? { label: "Eyewear" };
  const crumbs = [
    kindC,
    ...(product.brand && kindC.href ? [{ label: product.brand, href: `${kindC.href}?brand=${encodeURIComponent(product.brand)}` }] : []),
    { label: product.model },
  ];
  const lbImages = (product.images ?? []).map((img: string) => imgUrl(img)!).filter(Boolean);

  const addToBag = () => {
    const item={id:Math.random().toString(36).slice(2),productId:product.id,name:`${product.brand} ${product.model}`,brand:product.brand,image:product.images?.[0],framePrice:Number(product.selling_price),lensTotal:0,total:Number(product.selling_price),qty:1,power_eligible:false};
    try{const c=JSON.parse(localStorage.getItem("pe_cart_v3")??"[]");localStorage.setItem("pe_cart_v3",JSON.stringify([...c,item]));window.dispatchEvent(new Event("pe_cart_update"));}catch{}
    toast("Added to bag");
  };

  const onHeart = () => {
    toggle(id);
    toast(liked ? "Removed from wishlist" : "Saved to wishlist");
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Full site header — same component every other route renders */}
      <Header />

      <div className={`mx-auto max-w-6xl px-4 py-8 sm:px-6 ${showBar ? "pb-24" : ""}`}>
        {/* Breadcrumb */}
        <div className="mb-5">
          <Breadcrumb items={crumbs} />
        </div>

        {/* Main layout */}
        <div className="grid gap-8 lg:grid-cols-2 mb-10">
          {/* Gallery */}
          <div>
            <div className="relative aspect-square rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden flex items-center justify-center">
              {url
                ? <button type="button" onClick={()=>setLb(true)} aria-label="Zoom image" className="group relative flex h-full w-full items-center justify-center">
                    <img src={url} alt={product.model} className="max-h-80 max-w-full object-contain p-8 transition duration-300 group-hover:scale-[1.03]"/>
                    <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm opacity-0 transition group-hover:opacity-100">🔍 Click to zoom</span>
                  </button>
                : <span className="text-8xl">👓</span>}
              {d > 0 && <span className="absolute left-4 top-4 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">{d}% OFF</span>}
              <button onClick={onHeart} aria-label={liked?"Remove from wishlist":"Add to wishlist"} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white shadow-md hover:scale-110 transition">
                <Heart size={16} className={liked?"fill-rose-500 text-rose-500":"text-slate-400"}/>
              </button>
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {product.images.map((img:string,i:number) => (
                  <button key={i} onClick={()=>setImgIdx(i)}
                    className={`h-16 w-16 shrink-0 rounded-xl border-2 overflow-hidden transition ${imgIdx===i?"border-navy-700":"border-slate-100 hover:border-slate-300"}`}>
                    <img src={imgUrl(img)!} alt="" className="h-full w-full object-contain p-1"/>
                  </button>))}
              </div>)}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider">{product.brand}</p>
              <h1 className="font-extrabold text-2xl sm:text-3xl text-navy-900 mt-1 break-words">{product.model}</h1>
              {product.sku && <p className="text-xs text-slate-400 mt-0.5">SKU: {product.sku}</p>}
              {reviews.length > 0 && <div className="mt-2"><StarRow rating={avgRating} count={reviews.length}/></div>}
            </div>
            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-navy-900">{inr(product.selling_price)}</span>
              {d > 0 && <><span className="text-xl text-slate-400 line-through">{inr(product.mrp)}</span>
                <span className="rounded-full bg-rose-100 px-3 py-0.5 text-sm font-bold text-rose-600">{d}% OFF</span></>}
            </div>
            {/* Stock */}
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${product.in_stock?"bg-emerald-500":"bg-rose-500"}`}/>
              <span className={`text-sm font-medium ${product.in_stock?"text-emerald-700":"text-rose-600"}`}>
                {product.in_stock?`In Stock at ${storeName || "store"}`:"Currently Out of Stock"}
              </span>
            </div>
            {/* Attributes */}
            {product.attrs && (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
                {Object.entries(product.attrs as Record<string,any>).filter(([,v])=>v).map(([k,v])=>(
                  <div key={k}><span className="text-slate-400 capitalize">{k.replace("_"," ")}: </span><span className="font-medium capitalize text-navy-900">{String(v)}</span></div>))}
              </div>)}
            {/* Frame size guide */}
            {product.kind === "frame" && <div><SizeGuide /></div>}
            {/* CTAs */}
            <div className="space-y-3" ref={ctaRef}>
              {product.power_eligible
                ? <button onClick={()=>setConfOpen(true)} className="w-full rounded-2xl bg-gold-500 py-4 text-base font-bold text-white hover:bg-gold-600 transition shadow-lg shadow-gold-200">Choose Lenses →</button>
                : <button onClick={()=>{ addToBag(); router.push("/cart"); }} className="w-full rounded-2xl bg-navy-800 py-4 text-base font-bold text-white hover:bg-navy-700 transition">Add to Bag</button>}
              <div className="flex gap-2">
                <a href={waHref(whatsappNumber)} target="_blank" className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium hover:border-navy-700 transition">💬 Ask on WhatsApp</a>
                <button onClick={onHeart} className={`rounded-xl border px-4 py-3 transition ${liked?"border-rose-300 bg-rose-50 text-rose-500":"border-slate-200 hover:border-slate-300"}`}><Heart size={16}/></button>
              </div>
            </div>
            {/* Trust row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
              {[["🚚","Free Shipping above ₹999"],["🔄","Easy 7-day returns"],["🛡️","1-year warranty"]].map(([e,t])=>(
                <div key={t as string} className="flex items-center gap-1 rounded-xl bg-slate-50 p-2"><span>{e}</span><span>{t}</span></div>))}
            </div>
          </div>
        </div>

        {/* Tabs: Description | Reviews */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-8">
          <div className="flex border-b border-slate-100">
            {[["desc","Description"],["reviews",`Reviews (${reviews.length})`]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                className={`px-6 py-3.5 text-sm font-semibold transition ${tab===k?"border-b-2 border-navy-800 text-navy-900":"text-slate-500 hover:text-slate-700"}`}>{l}</button>))}
          </div>
          <div className="p-6">
            {tab==="desc" && (
              <div>
                {product.description
                  ? <p className="text-slate-600 leading-relaxed">{product.description}</p>
                  : <p className="text-slate-400">No description available.</p>}
              </div>)}
            {tab==="reviews" && (
              <div className="space-y-5">
                {/* Write review CTA */}
                <div className="flex items-center justify-between">
                  {reviews.length > 0
                    ? <StarRow rating={avgRating} count={reviews.length}/>
                    : <p className="text-slate-500 text-sm">No reviews yet. Be the first!</p>}
                  <button onClick={()=>setRevOpen(true)}
                    className="rounded-xl border border-navy-800 px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50 transition">
                    ✏️ Write a Review
                  </button>
                </div>
                {reviews.map(r=>(
                  <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2"><StarRow rating={r.rating} count={0}/>
                          {r.verified_purchase&&<span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">Verified</span>}</div>
                        {r.title&&<p className="font-semibold text-sm mt-1">{r.title}</p>}
                        <p className="text-sm text-slate-600 mt-1">{r.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{r.reviewer_name} · {new Date(r.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>
                      </div>
                    </div>
                  </div>))}
              </div>)}
          </div>
        </div>

        {/* Recently Viewed */}
        <RecentlyViewed excludeId={id}/>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="font-bold text-xl text-navy-900 mb-4">Similar Products</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((p:any)=>(
                <a key={p.id} href={`/product/${p.id}`} onClick={()=>trackView(p.id)}
                  className="group rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
                  <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                    {p.images?.[0]?<img src={`${SB_URL}/storage/v1/object/public/product-images/${p.images[0]}`} alt={p.model} className="h-full w-full object-contain p-3 group-hover:scale-105 transition duration-300"/>:<span className="text-3xl">👓</span>}
                  </div>
                  <div className="p-2.5"><p className="text-xs text-slate-400 truncate">{p.brand}</p>
                    <p className="text-xs font-semibold truncate">{p.model}</p>
                    <p className="text-xs font-bold text-navy-900 mt-0.5">₹{Number(p.selling_price).toLocaleString("en-IN")}</p></div>
                </a>))}
            </div>
          </section>)}
      </div>

      {/* Sticky add-to-cart bar — docked safely above mobile bottom nav on mobile */}
      {showBar && !lb && (
        <div className="fixed inset-x-0 bottom-14 lg:bottom-0 z-40 border-t border-slate-100 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(10,34,64,.08)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-navy-900">{product.brand} {product.model}</p>
              <p className="text-sm font-bold text-navy-900">{inr(product.selling_price)}
                {d > 0 && <span className="ml-1.5 text-xs font-normal text-slate-400 line-through">{inr(product.mrp)}</span>}</p>
            </div>
            {product.power_eligible
              ? <button onClick={()=>setConfOpen(true)} className="shrink-0 rounded-full bg-gold-500 px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white hover:bg-gold-600 transition active:scale-95 shadow-sm">Choose Lenses</button>
              : <button onClick={addToBag} className="shrink-0 rounded-full bg-navy-800 px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white hover:bg-navy-700 transition active:scale-95 shadow-sm">Add to Bag</button>}
          </div>
        </div>)}

      {/* Image lightbox */}
      <AnimatePresence>
        {lb && (
          <Lightbox
            images={lbImages}
            index={imgIdx}
            onIndex={setImgIdx}
            onClose={()=>setLb(false)} />
        )}
      </AnimatePresence>

      {/* Lens Configurator */}
      <LensConfigurator open={confOpen} onClose={()=>setConfOpen(false)} product={product}/>

      {/* Review Form Modal */}
      {revOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setRevOpen(false)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sticky top-0 bg-white z-10">
              <p className="font-bold text-navy-900">Write a Review</p>
              <button onClick={()=>setRevOpen(false)} className="rounded-full bg-slate-100 p-1.5 hover:bg-slate-200"><X size={16}/></button>
            </div>
            <ReviewForm productId={id} productName={`${product.brand} ${product.model}`} onClose={()=>setRevOpen(false)}/>
          </div>
        </div>)}
      <Footer/>
    </div>);
}
