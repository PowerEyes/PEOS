
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { imgUrl, inr } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Clock } from "lucide-react";

const KEY = "pe_recently_viewed";
const MAX = 10;

export function trackView(productId: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const updated = [productId, ...list.filter(id => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
  // Popularity counter behind the "N people viewed this today" card label
  // (migration 0022). Silently no-ops until that migration is applied.
  try { void supabaseBrowser().rpc("bump_product_view", { p_id: productId }); } catch {}
}

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const ids: string[] = JSON.parse(localStorage.getItem(KEY) ?? "[]")
      .filter((id: string) => id !== excludeId).slice(0, 6);
    if (!ids.length) return;
    supabaseBrowser().from("public_catalog").select("id,brand,model,selling_price,mrp,images,power_eligible")
      .in("id", ids).then(({ data }) => {
        // Preserve order from localStorage
        const sorted = ids.map(id => data?.find((p: any) => p.id === id)).filter(Boolean);
        setProducts(sorted as any[]);
      });
  }, [excludeId]);

  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 mb-5">
        <Clock size={18} className="text-slate-400"/>
        <h2 className="font-bold text-xl text-navy-900">Recently Viewed</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {products.map(p => (
          <a key={p.id} href={`/product/${p.id}`} rel="noopener"
            className="group rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
            <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
              {p.images?.[0]
                ? <img src={imgUrl(p.images[0])!} alt={p.model} className="h-full w-full object-contain p-3 group-hover:scale-105 transition duration-300"/>
                : <span className="text-3xl">👓</span>}
            </div>
            <div className="p-2.5">
              <p className="text-[11px] text-slate-400 truncate">{p.brand}</p>
              <p className="text-xs font-semibold text-navy-900 truncate">{p.model}</p>
              <p className="text-xs font-bold text-navy-900 mt-0.5">{inr(p.selling_price)}</p>
            </div>
          </a>))}
      </div>
    </section>);
}
