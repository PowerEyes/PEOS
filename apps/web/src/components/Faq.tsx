"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
export function Faq({ groups }: { groups: { title: string; items: { q: string; a: string }[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (<div className="space-y-8">{groups.map((g) => (<section key={g.title}><h2 className="mb-3 font-display text-lg font-bold text-navy-900">{g.title}</h2>
    <div className="space-y-2">{g.items.map((it) => { const k = g.title + it.q, on = open === k; return (
      <div key={k} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <button onClick={() => setOpen(on ? null : k)} aria-expanded={on} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-navy-900 hover:bg-slate-50">{it.q}<ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${on ? "rotate-180" : ""}`} /></button>
        {on && <div className="border-t border-slate-50 px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-600">{it.a}</div>}
      </div>); })}</div></section>))}</div>);
}
