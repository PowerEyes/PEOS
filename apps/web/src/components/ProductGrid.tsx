
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ProductCard } from "./ProductCard";
import { QuickView } from "./QuickView";
import { RecentlyViewed } from "./RecentlyViewed";
import { type Product } from "@/lib/types";

type Props = {
  products: Product[];
  showRecentlyViewed?: boolean;
  excludeRecentId?: string;
  /** Passed by the category pages; reserved for the filter sidebar. */
  brands?: string[];
  kind?: string;
};

const container = {
  hidden:{},
  show:{ transition:{ staggerChildren:.05 } },
};
const item = {
  hidden:{ opacity:0, y:16 },
  show:{ opacity:1, y:0, transition:{ type:"spring", damping:22, stiffness:260 } },
};

export function ProductGrid({ products, showRecentlyViewed, excludeRecentId }: Props) {  const [quickViewId, setQuickViewId] = useState<string|null>(null);

  if (!products.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <span className="text-5xl mb-4">🔍</span>
      <p className="font-semibold text-lg text-slate-600">No products match your filters</p>
      <p className="text-slate-400 text-sm mt-1">Try clearing a filter, or browse a popular category</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {[["Eyeglasses","/eyeglasses"],["Sunglasses","/sunglasses"],["Contact Lenses","/contact-lenses"],["Kids Eyewear","/kids"],["Offers","/offers"]].map(([l,h]) => (
          <a key={h} href={h} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-navy-700 hover:text-navy-900">{l}</a>))}
      </div>
    </div>);

  return (
    <>
      <motion.div
        variants={container} initial="hidden" animate="show"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map(p => (
          <motion.div key={p.id} variants={item}>
            <ProductCard p={p}/>
          </motion.div>))}
      </motion.div>

      {showRecentlyViewed && (
        <RecentlyViewed excludeId={excludeRecentId}/>
      )}

      {/* QuickView drawer — rendered once, controlled by productId state */}
      <QuickView
        productId={quickViewId}
        onClose={() => setQuickViewId(null)}/>
    </>);
}
