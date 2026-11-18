"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Pill } from "@poweros/ui";
import { Camera, Check, Glasses, Plus, Search, ScanBarcode, Globe, X, Printer } from "lucide-react";
import { KINDS, ctaFor, discountPct, inr, stockState, type Kind } from "@poweros/business-rules";
import { imgUrl } from "@/lib/image";
import { ProductDrawer } from "./product-drawer";
import { PackagesView } from "./packages";
import { OptionsView } from "./options";
import { DisplayView } from "./display";
import { CameraScanner } from "@/components/CameraScanner";

const total = (p: any) => (p.stock ?? []).reduce((a: number, s: any) => a + s.qty, 0);
const state = (p: any) => { const rows = p.stock ?? []; if (total(p) <= 0) return "out"; return rows.some((s: any) => stockState(s.qty, s.reorder_level) === "low") ? "low" : "in"; };
const TONE = { in: "green", low: "gold", out: "red" } as const; const LBL = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;

export function InventoryView({ products, brands, branches, packages, options, gst }: { products: any[]; brands: any[]; branches: any[]; packages: any[]; options: any[]; gst: boolean }) {
  const sp = useSearchParams(); const [tab, setTab] = useState<Kind | "packages" | "options" | "display">("frame"); const [q, setQ] = useState(""); const [brand, setBrand] = useState(""); const [sf, setSf] = useState(sp.get("stock") ?? "");
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [selMode, setSelMode] = useState(false); const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (sp.get("new")) setEditId("new"); }, [sp]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k.key, products.filter((p) => p.kind === k.key).length])), [products]);
  const attention = products.filter((p) => state(p) !== "in").length;
  const rows = products.filter((p) => p.kind === tab && (!brand || p.brand_id === brand) && (!sf || (sf === "low" ? state(p) !== "in" : state(p) === sf)) &&
    `${p.brands?.name ?? ""} ${p.model} ${p.sku} ${p.barcode} ${p.collection ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const cur = editId && editId !== "new" ? products.find((p) => p.id === editId) ?? null : null;
  const kind: Kind = tab === "packages" || tab === "options" || tab === "display" ? "frame" : tab; const [cam, setCam] = useState(false);
  function open(code: string) { const hit = products.find((p) => p.barcode === code.trim() || p.sku === code.trim().toUpperCase()); if (hit) { setTab(hit.kind); setEditId(hit.id); setQ(""); } else setQ(code); }
  function scan(e: React.KeyboardEvent) { if (e.key === "Enter") open(q); }
  function cardClick(id: string) { if (selMode) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); else setEditId(id); }
  return (<div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold">Inventory</h1><p className="text-slate-500">{products.length} products{attention > 0 && <button onClick={() => { setSf("low"); setTab("frame"); }} className="ml-2 font-medium text-amber-700 underline">{attention} need attention</button>}</p></div>
      {tab !== "packages" && tab !== "options" && tab !== "display" && <button onClick={() => setEditId("new")} className="btn btn-primary"><Plus size={16} />Add product</button>}</div>
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">{[...KINDS.map((k) => ({ key: k.key as string, label: k.label, n: counts[k.key] })), { key: "packages", label: "Lens packages", n: packages.length }, { key: "options", label: "Lens options", n: options.length }, { key: "display", label: "Display & Shelf", n: products.length }].map((t) => (
      <button key={t.key} onClick={() => setTab(t.key as any)} className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${tab === t.key ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}>
        {tab === t.key && <motion.span layoutId="invtab" className="absolute inset-0 rounded-xl bg-navy-800" />}<span className="relative">{t.label} <span className="opacity-60">{t.n}</span></span></button>))}</div>
    {tab === "packages" ? <PackagesView packages={packages} /> : tab === "options" ? <OptionsView options={options} /> : tab === "display" ? <DisplayView products={products} /> : <>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><div className="relative"><ScanBarcode size={16} className="absolute left-3 top-3.5 text-gold-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={scan} className="field pl-9" placeholder="Search, or scan a barcode and press Enter" /><button type="button" onClick={() => setCam(true)} aria-label="Scan with camera" className="absolute right-2 top-2 rounded-lg p-1.5 text-navy-700 hover:bg-slate-100"><Camera size={18} /></button></div>
        <select className="field" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="field" value={sf} onChange={(e) => setSf(e.target.value)}><option value="">All stock</option><option value="low">Needs attention</option><option value="out">Out of stock</option></select>
        <button onClick={() => { setSelMode((v) => !v); setSel([]); }} className={`btn whitespace-nowrap ${selMode ? "btn-primary" : "btn-ghost"}`}>{selMode ? "Done" : <><Printer size={15} />Select &amp; print</>}</button></div>
      {rows.length === 0 ? <div className="card p-10 text-center text-slate-500"><Glasses className="mx-auto mb-2" />Nothing here yet. Add a product to start counting stock.</div> :
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{rows.map((p, i) => { const s = state(p); const d = discountPct(p.mrp, p.selling_price); return (
          <motion.button key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} whileHover={{ y: -4 }} onClick={() => cardClick(p.id)} className={`card overflow-hidden text-left ${sel.includes(p.id) ? "ring-2 ring-gold-500" : ""}`}>
            <div className="relative grid aspect-[4/3] place-items-center bg-gradient-to-br from-navy-50 to-white">{p.images?.[0] ? <img src={imgUrl(p.images[0])} alt="" className="h-full w-full object-contain p-3" /> : <Glasses size={44} className="text-slate-300" />}
              {p.visible_on_website && <Globe size={14} className="absolute right-2 top-2 text-gold-500" />}{d && <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">{d}% OFF</span>}
              {selMode && <span className={`absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full border-2 ${sel.includes(p.id) ? "border-gold-500 bg-gold-500 text-white" : "border-slate-300 bg-white/90"}`}>{sel.includes(p.id) && <Check size={14} />}</span>}</div>
            <div className="space-y-1 p-3"><p className="truncate text-xs text-slate-500">{p.brands?.name ?? "No brand"} | {p.sku}</p><p className="truncate font-semibold">{p.model}</p>
              <p className="font-bold">{inr(p.selling_price)} {p.mrp > p.selling_price && <span className="text-xs font-normal text-slate-400 line-through">{inr(p.mrp)}</span>}</p>
              <div className="flex items-center justify-between pt-1"><Pill tone={TONE[s]}>{LBL[s]}: {total(p)}</Pill>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.power_eligible ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{ctaFor(p)}</span></div></div></motion.button>); })}</div>}</>}
    {selMode && (
      <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-2xl print:hidden">
        <span className="whitespace-nowrap text-sm font-semibold">{sel.length ? `${sel.length} selected` : "Tap products to select"}</span>
        {sel.length > 0 && <a href={`/print/labels?ids=${sel.join(",")}&copies=1`} target="_blank" rel="noreferrer" className="btn btn-gold !py-2"><Printer size={15} />Print {sel.length} label{sel.length > 1 ? "s" : ""}</a>}
        <button onClick={() => setSel([])} disabled={!sel.length} className="text-xs text-slate-300 underline hover:text-white disabled:opacity-40">Clear</button>
        <button onClick={() => { setSelMode(false); setSel([]); }} aria-label="Exit select mode" className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X size={16} /></button>
      </div>)}
    <CameraScanner open={cam} onClose={() => setCam(false)} onResult={open} />
    <ProductDrawer open={editId !== null} onClose={() => setEditId(null)} product={cur} kind={kind} brands={brands} branches={branches} gst={gst} />
  </div>);
}
