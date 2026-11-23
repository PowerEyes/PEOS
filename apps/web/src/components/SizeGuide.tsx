"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Ruler, BookOpen } from "lucide-react";
import type { GuideBody } from "@/lib/pages";

type G = { title: string; subtitle?: string | null; body: GuideBody };
const cache = new Map<string, G | null>();

/**
 * Database-driven guide (ERP > Website > Pages & Guides, slug `guide-<page>`). Each listing page passes its own `page`.
 * The FRAME size guide is only rendered by the eyeglasses page / frame cards (page="eyeglasses").
 * Hidden automatically if the operator deactivates the guide.
 */
export function GuideButton({ page, label, className = "" }: { page: string; label?: string; className?: string }) {
  const slug = `guide-${page}`;
  const [open, setOpen] = useState(false);
  const [g, setG] = useState<G | null | undefined>(cache.get(slug));
  useEffect(() => {
    if (cache.has(slug)) return;
    fetch(`/api/guide?slug=${slug}`).then((r) => (r.ok ? r.json() : null)).then((j) => { cache.set(slug, j); setG(j); }).catch(() => setG(null));
  }, [slug]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open]);
  if (g === null) return null; // guide switched off / missing
  const Icon = page === "eyeglasses" ? Ruler : BookOpen;
  const btn = className || "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-navy-700 hover:text-navy-900 active:scale-95";
  return (<>
    <button type="button" onClick={() => setOpen(true)} className={btn}><Icon size={14} />{label ?? g?.title ?? "Guide"}</button>
    {open && g && createPortal(
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={g.title}>
        <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-navy-900 to-navy-800 px-5 py-4 text-white">
            <div><h2 className="font-display text-lg font-bold">{g.title}</h2>{g.subtitle && <p className="text-xs text-slate-300">{g.subtitle}</p>}</div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"><X size={16} /></button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5">
            {(g.body.sections ?? []).map((s, i) => (<div key={i} className="rounded-2xl bg-slate-50 p-4">{s.heading && <p className="font-semibold text-navy-900">{s.icon} {s.heading}</p>}{s.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.body}</p>}</div>))}
            {g.body.table?.headers?.length ? (<div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full text-left text-sm"><thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-800"><tr>{g.body.table.headers.map((h, i) => <th key={i} className="px-3 py-2.5">{h}</th>)}</tr></thead><tbody>{g.body.table.rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="px-3 py-2.5 text-slate-700">{c}</td>)}</tr>)}</tbody></table></div>) : null}
          </div>
        </div>
      </div>, document.body)}
  </>);
}
/** Frame size guide — eyeglasses only. */
export const SizeGuide = ({ label = "Frame Size Guide", className = "" }: { label?: string; className?: string }) => <GuideButton page="eyeglasses" label={label} className={className} />;
