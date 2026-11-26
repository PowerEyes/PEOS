"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer, Pill, useToast } from "@poweros/ui";
import { Plus } from "lucide-react";
import { inr } from "@poweros/business-rules";
import { saveLensOption } from "./actions";
const DESIGNS = ["single_vision", "progressive", "bifocal", "reading", "non_prescription"];
const blank = { grp: "addon", code: "", name: "", description: "", price: "", tax_pct: "5", badge: "", designs: [] as string[], status: "active", display_order: "0" };
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;
export function OptionsView({ options }: { options: any[] }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [cur, setCur] = useState<any>(null); const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(cur ? { ...cur, description: cur.description ?? "", price: String(cur.price), tax_pct: String(cur.tax_pct), badge: cur.badge ?? "", display_order: String(cur.display_order) } : blank); }, [open, cur]);
  async function save() { const r = await saveLensOption({ id: cur?.id, grp: f.grp, code: f.code, name: f.name, description: f.description || null, price: f.price === "" ? null : Number(f.price), tax_pct: Number(f.tax_pct),
      badge: f.badge || null, designs: f.designs, status: f.status, display_order: Number(f.display_order || 0) });
    if (r.error) return toast(r.error, "err"); toast(`${r.ok} saved`); router.refresh(); setOpen(false); }
  const Group = ({ g, title }: { g: string; title: string }) => (<div className="space-y-2"><h3 className="font-semibold">{title}</h3>
    <div className="card divide-y divide-slate-100 overflow-hidden">{options.filter((o) => o.grp === g).map((o) => (
      <button key={o.id} onClick={() => { setCur(o); setOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-navy-50">
        <span className="min-w-0 flex-1"><span className="block font-medium">{o.name} {o.badge && <Pill tone="gold">{o.badge}</Pill>}</span><span className="block truncate text-xs text-slate-500">{o.description}</span></span>
        <span className="font-semibold">{o.price > 0 ? `+${inr(o.price)}` : "Included"}</span><Pill tone={o.status === "active" ? "green" : "grey"}>{o.status}</Pill></button>))}
      {options.filter((o) => o.grp === g).length === 0 && <p className="p-4 text-sm text-slate-500">None yet.</p>}</div></div>);
  return (<div className="space-y-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">These appear in the POS lens picker and the website lens wizard. Draft items stay hidden.</p>
    <button onClick={() => { setCur(null); setOpen(true); }} className="btn btn-primary"><Plus size={16} />Add option</button></div>
    <Group g="index" title="Lens index" /><Group g="addon" title="Add-ons and coatings" />
    <Drawer open={open} onClose={() => setOpen(false)} title={cur ? cur.name : "Add lens option"} footer={<><button onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button><button onClick={save} className="btn btn-gold">Save option</button></>}>
      <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><L t="Type"><select className="field" value={f.grp} onChange={(e) => setF({ ...f, grp: e.target.value })}><option value="addon">Add-on or coating</option><option value="index">Lens index</option></select></L>
        <L t="Code *"><input className="field" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></L></div>
        <L t="Name *"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
        <L t={`Description (${f.description.length}/150)`}><input maxLength={150} className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
        <div className="grid grid-cols-3 gap-3"><L t="Extra price *"><input className="field" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></L>
          <L t="GST %"><select className="field" value={f.tax_pct} onChange={(e) => setF({ ...f, tax_pct: e.target.value })}>{["0", "5", "12", "18"].map((t) => <option key={t}>{t}</option>)}</select></L>
          <L t="Badge"><input className="field" maxLength={20} placeholder="Most Popular" value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} /></L></div>
        <div><span className="mb-1 block text-xs text-slate-500">Offered with (none selected = every lens design)</span><div className="flex flex-wrap gap-2">{DESIGNS.map((d) => <button key={d} type="button" onClick={() => setF({ ...f, designs: f.designs.includes(d) ? f.designs.filter((x: string) => x !== d) : [...f.designs, d] })}
          className={`rounded-full border px-3 py-1 text-sm capitalize ${f.designs.includes(d) ? "border-gold-500 bg-amber-50" : "border-slate-200"}`}>{d.replace("_", " ")}</button>)}</div></div>
        <div className="grid grid-cols-2 gap-3"><L t="Status"><select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{["active", "draft", "inactive"].map((s) => <option key={s}>{s}</option>)}</select></L>
          <L t="Display order"><input type="number" className="field" value={f.display_order} onChange={(e) => setF({ ...f, display_order: e.target.value })} /></L></div></div></Drawer></div>);
}
