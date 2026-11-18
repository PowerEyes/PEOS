"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { inr } from "@/lib/types";

type Props = {
  /** Distinct values pulled from the catalog by the listing page. */
  brands: string[];
  shapes: string[];
  genders: string[];
  bounds: { min: number; max: number };
};

const chip = (on: boolean) =>
  `capitalize rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    on ? "border-navy-800 bg-navy-800 text-white"
       : "border-slate-200 bg-white text-slate-600 hover:border-navy-600 hover:text-navy-800"}`;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>);
}

/** Dual-thumb price slider with the live "₹999 – ₹8,500" label above it. */
function PriceRange({ lo, hi, min, max, step, setLo, setHi }: {
  lo: number; hi: number; min: number; max: number; step: number;
  setLo: (v: number) => void; setHi: (v: number) => void;
}) {
  if (max <= min) return null;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-navy-800 [&::-webkit-slider-thumb]:shadow-md " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-navy-800 [&::-moz-range-thumb]:shadow-md";
  return (
    <div>
      <p className="mb-1.5 text-center text-sm font-bold text-navy-900">{inr(lo)} – {inr(hi)}</p>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gold-500"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={min} max={max} step={step} value={lo} aria-label="Minimum price"
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))} className={thumb} />
        <input type="range" min={min} max={max} step={step} value={hi} aria-label="Maximum price"
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))} className={thumb} />
      </div>
    </div>);
}

/**
 * Filter bar for the listing pages: collapsible panel of chips (brand /
 * shape / gender) + price range. A live count badge on the Filters button
 * ("Filter (3)") survives the panel being closed; everything syncs to URL
 * searchParams so results, back-button and sharing all stay honest.
 */
export function ProductFilters({ brands, shapes, genders, bounds }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [shape, setShape] = useState(sp.get("shape") ?? "");
  const [gender, setGender] = useState(sp.get("gender") ?? "");
  const [lo, setLo] = useState(Number(sp.get("min")) || bounds.min);
  const [hi, setHi] = useState(Number(sp.get("max")) || bounds.max);

  const step = bounds.max - bounds.min > 8000 ? 100 : 50;

  const pushUrl = (b: string, s: string, g: string, mn: number, mx: number) => {
    const p = new URLSearchParams();
    if (b) p.set("brand", b);
    if (s) p.set("shape", s);
    if (g) p.set("gender", g);
    if (mn > bounds.min) p.set("min", String(mn));
    if (mx < bounds.max) p.set("max", String(mx));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Chips apply immediately; price applies once the user stops dragging.
  const skipChips = useRef(true);
  useEffect(() => {
    if (skipChips.current) { skipChips.current = false; return; }
    pushUrl(brand, shape, gender, lo, hi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, shape, gender]);

  const skipPrice = useRef(true);
  useEffect(() => {
    if (skipPrice.current) { skipPrice.current = false; return; }
    const t = setTimeout(() => pushUrl(brand, shape, gender, lo, hi), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi]);

  const n = (brand ? 1 : 0) + (shape ? 1 : 0) + (gender ? 1 : 0) + (lo > bounds.min || hi < bounds.max ? 1 : 0);
  const clear = () => { setBrand(""); setShape(""); setGender(""); setLo(bounds.min); setHi(bounds.max); };

  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            n > 0 ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-navy-600"}`}>
          <SlidersHorizontal size={15} /> Filters
          {n > 0 && <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-white">{n}</span>}
        </button>
        {n > 0 && !open && (
          <button onClick={clear} className="text-xs font-medium text-slate-500 underline transition hover:text-navy-800">
            Clear {n} filter{n > 1 ? "s" : ""}
          </button>)}
      </div>

      {open && (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {shapes.length > 0 && (
              <Section label="Shape">
                {shapes.map((s) => <button key={s} onClick={() => setShape(shape === s ? "" : s)} className={chip(shape === s)}>{s}</button>)}
              </Section>)}
            {genders.length > 0 && (
              <Section label="Frame for">
                {genders.map((g) => <button key={g} onClick={() => setGender(gender === g ? "" : g)} className={chip(gender === g)}>{g}</button>)}
              </Section>)}
            {brands.length > 0 && (
              <div className="sm:col-span-2">
                <Section label="Brand">
                  {brands.map((b) => <button key={b} onClick={() => setBrand(brand === b ? "" : b)} className={chip(brand === b)}>{b}</button>)}
                </Section>
              </div>)}
            <div className="border-t border-slate-100 pt-3 sm:col-span-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Price</p>
              <PriceRange lo={lo} hi={hi} min={bounds.min} max={bounds.max} step={step} setLo={setLo} setHi={setHi} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <button onClick={clear} className="text-xs font-medium text-slate-500 underline transition hover:text-navy-800">Clear all</button>
            <button onClick={() => setOpen(false)} className="btn-gold px-5 py-2 text-xs">Show results</button>
          </div>
        </div>)}
    </div>);
}
