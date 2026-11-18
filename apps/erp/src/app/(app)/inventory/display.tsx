"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Save, Search, LayoutGrid, Printer } from "lucide-react";
import { KINDS } from "@poweros/business-rules";
import { saveDisplay } from "./actions";

const SECTIONS = [["window", "Window"], ["counter", "Counter"], ["wall", "Wall"], ["shelf", "Shelf"], ["back_store", "Back store"]] as const;
type Section = (typeof SECTIONS)[number][0];
const secLabel = (v: string) => SECTIONS.find(([k]) => k === v)?.[1] ?? v;
// Short section codes for location barcodes: LOC-WIN-A2, LOC-SHF-RACK-1 …
const SEC3: Record<string, string> = { window: "WIN", counter: "CNT", wall: "WAL", shelf: "SHF", back_store: "BST" };
const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type Edit = { on_display: boolean; display_section: Section; shelf_location: string; display_order: number };

export function DisplayView({ products }: { products: any[] }) {
  const router = useRouter(); const toast = useToast();
  const [q, setQ] = useState(""); const [sec, setSec] = useState(""); const [disp, setDisp] = useState(""); // section / on-display filters
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => products.filter((p) => {
    if (sec && (edits[p.id]?.display_section ?? p.display_section ?? "shelf") !== sec) return false;
    if (disp === "on" && !(edits[p.id]?.on_display ?? p.on_display ?? true)) return false;
    if (disp === "off" && (edits[p.id]?.on_display ?? p.on_display ?? true)) return false;
    return `${p.brands?.name ?? ""} ${p.model} ${p.sku} ${p.shelf_location ?? ""}`.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => {
    const ea = edits[a.id], eb = edits[b.id];
    const oa = ea ? ea.display_order : (a.display_order ?? 0), ob = eb ? eb.display_order : (b.display_order ?? 0);
    return oa - ob || `${a.brands?.name ?? ""}${a.model}`.localeCompare(`${b.brands?.name ?? ""}${b.model}`);
  }), [products, q, sec, disp, edits]);

  const cur = (p: any): Edit => edits[p.id] ?? cur0(p);
  const set = (id: string, patch: Partial<Edit>) => setEdits((x) => {
    const p = products.find((y) => y.id === id);
    if (!p) return x;
    return { ...x, [id]: { ...(x[id] ?? cur0(p)), ...patch } };
  });
  const dirty = (p: any) => { const e = edits[p.id]; if (!e) return false; const b = cur0(p);
    return e.on_display !== b.on_display || e.display_section !== b.display_section || e.shelf_location !== b.shelf_location || e.display_order !== b.display_order; };
  const dirtyCount = products.filter(dirty).length;
  // Distinct shelf locations (unsaved edits included) — one 60×40 label each
  const locs = [...new Set(products.map((p) => { const e = cur(p); const sh = slug(e.shelf_location); return `LOC-${SEC3[e.display_section] ?? "LOC"}${sh ? `-${sh}` : ""}`; }))];

  async function save() {
    setBusy(true);
    const rows = products.filter(dirty).map((p) => { const e = edits[p.id]; return { id: p.id, ...e, shelf_location: e.shelf_location.trim() || null }; });
    const r = await saveDisplay(rows);
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    toast(r.ok ?? "Saved"); setEdits({}); router.refresh();
  }

  return (<div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="field pl-9" placeholder="Search brand, model, SKU, shelf…" /></div>
      <div className="flex items-center gap-2">
        {locs.length > 0 && <a href={`/print/locations?codes=${encodeURIComponent(locs.join(","))}&copies=1`} target="_blank" rel="noreferrer" className="btn btn-ghost whitespace-nowrap"><Printer size={15} />Location labels ({locs.length})</a>}
        {dirtyCount > 0 && <span className="text-sm font-medium text-amber-700">{dirtyCount} unsaved</span>}
        <button disabled={busy || dirtyCount === 0} onClick={save} className="btn btn-primary disabled:opacity-50">
          <Save size={15} />{busy ? "Saving…" : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}</button></div></div>

    <div className="flex flex-wrap gap-2">
      <button onClick={() => setSec("")} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${!sec ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>All sections</button>
      {SECTIONS.map(([k, lab]) => <button key={k} onClick={() => setSec(k)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${sec === k ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{lab}</button>)}
      <span className="mx-1 hidden w-px bg-slate-200 sm:block" />
      {[["", "All"], ["on", "On display"], ["off", "Not on display"]].map(([k, lab]) => <button key={k} onClick={() => setDisp(k)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${disp === k ? "border-gold-500 bg-amber-50 text-gold-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{lab}</button>)}
    </div>

    {rows.length === 0 ? <div className="card p-10 text-center text-slate-500"><LayoutGrid className="mx-auto mb-2" />No products match this filter.</div> :
      <div className="card overflow-x-auto p-0"><table className="w-full min-w-[860px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="px-4 py-3">Product</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">On display</th>
          <th className="px-4 py-3">Section</th><th className="px-4 py-3">Shelf location</th><th className="px-4 py-3 w-28">Order</th></tr></thead>
        <tbody>{rows.map((p) => { const e = cur(p); const on = dirty(p);
          return (<tr key={p.id} className={`border-b border-slate-50 last:border-0 ${on ? "bg-amber-50/40" : ""}`}>
            <td className="px-4 py-2.5"><p className="font-medium text-navy-900">{p.brands?.name ?? ""} {p.model}</p><p className="text-xs text-slate-400">{p.sku}</p></td>
            <td className="px-4 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{KINDS.find((k) => k.key === p.kind)?.label ?? p.kind}</span></td>
            <td className="px-4 py-2.5">
              <button role="switch" aria-checked={e.on_display} onClick={() => set(p.id, { on_display: !e.on_display })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${e.on_display ? "bg-gold-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${e.on_display ? "left-[22px]" : "left-0.5"}`} /></button></td>
            <td className="px-4 py-2.5"><select className="field !py-2" value={e.display_section} onChange={(ev) => set(p.id, { display_section: ev.target.value as Section })}>
              {SECTIONS.map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}</select></td>
            <td className="px-4 py-2.5"><input className="field !py-2" placeholder="e.g. Rack A-2" value={e.shelf_location} onChange={(ev) => set(p.id, { shelf_location: ev.target.value })} /></td>
            <td className="px-4 py-2.5"><input type="number" min={0} className="field !py-2" value={e.display_order} onChange={(ev) => set(p.id, { display_order: ev.target.value === "" ? 0 : Number(ev.target.value) })} /></td>
          </tr>); })}</tbody></table></div>}
    <p className="text-xs text-slate-400">Tip: rows with unsaved edits are highlighted. Order decides sorting within a section. <b>Location labels</b> prints a 60 × 40 mm sign for every tray, rack and shelf.</p>
  </div>);
}

// baseline snapshot without edits (used for dirty-checking)
function cur0(p: any): Edit {
  return { on_display: p.on_display ?? true, display_section: (p.display_section ?? "shelf") as Section,
    shelf_location: p.shelf_location ?? "", display_order: p.display_order ?? 0 };
}
