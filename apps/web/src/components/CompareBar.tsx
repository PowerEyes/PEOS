
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, BarChart3 } from "lucide-react";
import { imgUrl } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";

const KEY = "pe_compare";

export function getCompareIds(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function toggleCompare(id: string): boolean {
  const ids = getCompareIds();
  let added = false;
  let updated: string[];
  if (ids.includes(id)) { updated = ids.filter(i => i !== id); }
  else if (ids.length >= 3) { alert("You can compare up to 3 products at a time."); return false; }
  else { updated = [...ids, id]; added = true; }
  localStorage.setItem(KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("pe_compare_update"));
  return added;
}

export function CompareBar() {
  const [ids, setIds] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const sync = () => {
      const current = getCompareIds();
      setIds(current);
      if (!current.length) { setProducts([]); return; }
      supabaseBrowser().from("public_catalog").select("id,brand,model,images").in("id", current)
        .then(({ data }) => setProducts((data ?? []) as any[]));
    };
    sync();
    window.addEventListener("pe_compare_update", sync);
    return () => window.removeEventListener("pe_compare_update", sync);
  }, []);

  if (!ids.length) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4">
      <div className="rounded-2xl bg-navy-900 shadow-2xl border border-white/10 px-5 py-4 flex items-center gap-4">
        <BarChart3 size={18} className="text-gold-400 shrink-0"/>
        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {products.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 shrink-0">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                {p.images?.[0]
                  ? <img src={imgUrl(p.images[0])!} alt="" className="h-full w-full object-contain p-1"/>
                  : <span className="text-lg">👓</span>}
              </div>
              <div className="text-white min-w-0 max-w-24">
                <p className="text-[10px] text-slate-400 truncate">{p.brand}</p>
                <p className="text-xs font-semibold truncate">{p.model}</p>
              </div>
              <button onClick={() => toggleCompare(p.id)} className="text-slate-400 hover:text-white transition">
                <X size={14}/>
              </button>
            </div>))}
          {ids.length < 3 && (
            <div className="h-10 w-10 shrink-0 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 text-xl">+</div>)}
        </div>
        <Link href={`/compare?ids=${ids.join(",")}`}
          className="shrink-0 rounded-xl bg-gold-500 px-4 py-2 text-xs font-bold text-white hover:bg-gold-600 transition whitespace-nowrap">
          Compare {ids.length}
        </Link>
        <button onClick={() => { localStorage.setItem(KEY,"[]"); window.dispatchEvent(new Event("pe_compare_update")); }}
          className="shrink-0 text-slate-400 hover:text-white transition"><X size={16}/></button>
      </div>
    </div>);
}
