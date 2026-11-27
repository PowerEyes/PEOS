"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X, Check, ArrowUpDown } from "lucide-react";
import { inr } from "@/lib/types";
import type { Facet } from "@/lib/facets";

const SORTS: [string, string][] = [["", "Recommended"], ["new", "New arrivals"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["discount", "Biggest discount"]];
const norm = (s: string) => s.toLowerCase().replace(/[-_]+/g, " ").trim();

/** URL-synced product filters. Desktop: sticky left sidebar. Mobile: bottom sheet. */
export function ProductFilters({ facets, bounds, total, shown }: { facets: Facet[]; bounds: { min: number; max: number }; total: number; shown: number }) {
  const router = useRouter(), pathname = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [lo, setLo] = useState(Number(sp.get("min")) || bounds.min);
  const [hi, setHi] = useState(Number(sp.get("max")) || bounds.max);
  const step = bounds.max - bounds.min > 8000 ? 100 : 50;
  const sel = (k: string) => (sp.get(k) ?? "").split(",").map(norm).filter(Boolean);

  const push = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const toggle = (k: string, v: string) => push((p) => {
    const cur = (p.get(k) ?? "").split(",").filter(Boolean);
    const i = cur.findIndex((x) => norm(x) === norm(v));
    if (i >= 0) cur.splice(i, 1); else cur.push(v);
    cur.length ? p.set(k, cur.join(",")) : p.delete(k);
  });
  const setOne = (k: string, v: string) => push((p) => (v ? p.set(k, v) : p.delete(k)));
  useEffect(() => {
    const t = setTimeout(() => {
      if (lo !== (Number(sp.get("min")) || bounds.min) || hi !== (Number(sp.get("max")) || bounds.max)) {
        push((p) => { lo > bounds.min ? p.set("min", String(lo)) : p.delete("min"); hi < bounds.max ? p.set("max", String(hi)) : p.delete("max"); });
      }
    }, 350);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [lo, hi]);
  useEffect(() => {
    setLo(Number(sp.get("min")) || bounds.min);
    setHi(Number(sp.get("max")) || bounds.max);
    /* eslint-disable-next-line */
  }, [sp.get("min"), sp.get("max")]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    if (window.innerWidth < 1024) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const active: { k: string; v: string; label: string }[] = [];
  facets.forEach((f) => sel(f.key).forEach((v) => active.push({ k: f.key, v, label: f.options.find((o) => norm(o.value) === v)?.value ?? v })));
  const priceOn = lo > bounds.min || hi < bounds.max, stockOn = sp.get("stock") === "1";
  const n = active.length + (priceOn ? 1 : 0) + (stockOn ? 1 : 0);
  const clear = () => {
    setLo(bounds.min); setHi(bounds.max);
    const p = new URLSearchParams();
    const s = sp.get("sort");
    if (s) p.set("sort", s);
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false });
  };
  const pct = (v: number) => ((v - bounds.min) / Math.max(1, bounds.max - bounds.min)) * 100;
  const thumb = "pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-navy-800 [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-navy-800";

  const body = (
    <div className="space-y-6">
      {facets.map((f) => (
        <div key={f.key}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{f.label}</p>
          <div className="flex flex-wrap gap-2">
            {f.options.map((o) => {
              const on = sel(f.key).includes(norm(o.value));
              return (
                <button key={o.value} onClick={() => toggle(f.key, o.value)} aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium capitalize transition active:scale-95 ${on ? "border-navy-800 bg-navy-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-navy-500"}`}>
                  {on && <Check size={12} />}{o.value}<span className={`text-[10px] ${on ? "text-white/70" : "text-slate-400"}`}>{o.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {bounds.max > bounds.min && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Price</p>
          <p className="mb-2 text-center text-sm font-bold text-navy-900">{inr(lo)} – {inr(hi)}</p>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
            <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gold-500" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
            <input type="range" aria-label="Minimum price" min={bounds.min} max={bounds.max} step={step} value={lo} onChange={(e) => setLo(Math.min(+e.target.value, hi - step))} className={thumb} />
            <input type="range" aria-label="Maximum price" min={bounds.min} max={bounds.max} step={step} value={hi} onChange={(e) => setHi(Math.max(+e.target.value, lo + step))} className={thumb} />
          </div>
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
        In stock only
        <input type="checkbox" checked={stockOn} onChange={(e) => setOne("stock", e.target.checked ? "1" : "")} className="h-5 w-5 accent-navy-800" />
      </label>
    </div>
  );

  const chips = n > 0 && (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {active.map((a) => (
        <button key={a.k + a.v} onClick={() => toggle(a.k, a.v)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium capitalize text-navy-800">
          {a.label}<X size={12} />
        </button>
      ))}
      {priceOn && <button onClick={() => { setLo(bounds.min); setHi(bounds.max); }} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy-50 px-3 py-1.5 text-xs font-medium text-navy-800">{inr(lo)}–{inr(hi)}<X size={12} /></button>}
      <button onClick={clear} className="shrink-0 px-2 text-xs font-semibold text-slate-500 underline">Clear all</button>
    </div>
  );

  const sortSelect = (
    <label className="relative inline-flex items-center">
      <ArrowUpDown size={14} className="pointer-events-none absolute left-3 text-slate-500" />
      <select value={sp.get("sort") ?? ""} onChange={(e) => setOne("sort", e.target.value)} aria-label="Sort products"
        className="w-full appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-navy-600">
        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <>
      {/* Desktop sidebar — mounted by CatalogListing as the first grid column. */}
      <aside aria-label="Product filters" className="hidden lg:block">
        <div className="sticky top-[calc(var(--hdr,64px)+1rem)] max-h-[calc(100dvh-var(--hdr,64px)-2rem)] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-900">Filters{n > 0 && ` (${n})`}</h2>
            {n > 0 && <button onClick={clear} className="text-xs font-semibold text-slate-500 underline">Clear all</button>}
          </div>
          {sortSelect}
          {chips}
          <div className="mt-5">{body}</div>
          <p className="mt-5 text-xs text-slate-500" aria-live="polite">{shown === total ? `${total} products` : `${shown} of ${total}`}</p>
        </div>
      </aside>

      {/* Mobile / tablet utility bar + bottom sheet. */}
      <div className="sticky top-[var(--hdr,64px)] z-30 -mx-4 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={() => setOpen(true)} aria-expanded={open}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${n ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-navy-600"}`}>
            <SlidersHorizontal size={15} />Filters{n > 0 && <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-white">{n}</span>}
          </button>
          {sortSelect}
          <span className="ml-auto text-xs text-slate-500" aria-live="polite">{shown === total ? `${total} products` : `${shown} of ${total}`}</span>
        </div>
        {chips}
      </div>

      <AnimatePresence>{open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <span className="font-bold text-navy-900">Filters {n > 0 && `(${n})`}</span>
              <button onClick={() => setOpen(false)} aria-label="Close filters" className="rounded-full bg-slate-100 p-2"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{body}</div>
            <div className="flex items-center gap-3 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button onClick={clear} className="px-3 py-3 text-sm font-semibold text-slate-600 underline">Clear</button>
              <button onClick={() => setOpen(false)} className="btn-gold flex-1 py-3.5 text-sm font-bold">Show {shown} result{shown === 1 ? "" : "s"}</button>
            </div>
          </motion.div>
        </div>
      )}</AnimatePresence>
    </>
  );
}
