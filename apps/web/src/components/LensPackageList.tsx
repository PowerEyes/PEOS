"use client";
import { useMemo, useState } from "react";
import { inr } from "@/lib/types";
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-xs font-medium capitalize transition active:scale-95 ${on ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-navy-500"}`;
/** Filterable lens packages — design / index / coating chips are derived from the lens_packages rows. */
export function LensPackageList({ pkgs }: { pkgs: any[] }) {
  const uniq = (f: (p: any) => string[]) => [...new Set(pkgs.flatMap(f).filter(Boolean))];
  const designs = uniq((p) => [p.design]), indexes = uniq((p) => p.indexes ?? []), coats = uniq((p) => p.coatings ?? []);
  const [d, setD] = useState(""), [i, setI] = useState(""), [c, setC] = useState(""), [sort, setSort] = useState("");
  const list = useMemo(() => { let r = pkgs.filter((p) => (!d || p.design === d) && (!i || (p.indexes ?? []).includes(i)) && (!c || (p.coatings ?? []).includes(c)));
    if (sort === "asc") r = [...r].sort((a, b) => a.base_price - b.base_price); if (sort === "desc") r = [...r].sort((a, b) => b.base_price - a.base_price); return r; }, [pkgs, d, i, c, sort]);
  const Row = ({ label, items, v, set }: { label: string; items: string[]; v: string; set: (s: string) => void }) => items.length < 2 ? null : (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {items.map((x) => <button key={x} onClick={() => set(v === x ? "" : x)} aria-pressed={v === x} className={chip(v === x)}>{x.replace(/_/g, " ")}</button>)}</div>);
  return (<div className="space-y-4">
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
      <Row label="Design" items={designs} v={d} set={setD} /><Row label="Index" items={indexes} v={i} set={setI} /><Row label="Coating" items={coats} v={c} set={setC} />
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500"><span>{list.length} of {pkgs.length} packages</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"><option value="">Recommended</option><option value="asc">Price: low to high</option><option value="desc">Price: high to low</option></select></div>
    </div>
    {list.length === 0 ? <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No lens package matches. Clear a filter.</p> :
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => (
      <div key={p.id} className="card space-y-3 p-4 sm:p-6">
        <div><p className="font-display text-lg font-bold text-navy-900 sm:text-xl">{p.name}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{p.code} | {p.design?.replace("_", " ")}</p></div>
        {p.short_desc && <p className="text-sm text-slate-600">{p.short_desc}</p>}
        <ul className="space-y-1">{(p.features || []).slice(0, 4).map((f: string) => <li key={f} className="flex items-center gap-2 text-xs text-slate-700"><span className="text-gold-500">✓</span>{f}</li>)}</ul>
        <div className="border-t border-slate-100 pt-2"><p className="text-xl font-bold text-navy-900 sm:text-2xl">from {inr(p.base_price)}</p>{p.mrp && <p className="text-xs text-slate-400 line-through">{inr(p.mrp)}</p>}
          <div className="mt-2 flex flex-wrap gap-1">{(p.indexes || []).map((x: string) => <span key={x} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{x}</span>)}{(p.coatings || []).map((x: string) => <span key={x} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">{x}</span>)}</div></div>
      </div>))}</div>}
  </div>);
}
