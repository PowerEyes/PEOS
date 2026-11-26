"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer, Pill, useToast } from "@poweros/ui";
import { Plus, Star, Trash2, UploadCloud } from "lucide-react";
import { inr } from "@poweros/business-rules";
import { imgUrl, shrink } from "@/lib/image";
import { putImage } from "@/lib/upload";
import { saveLensPackage } from "./actions";
const DESIGNS = ["single_vision", "progressive", "bifocal", "reading", "non_prescription"]; const IDX = ["1.50", "1.56", "1.60", "1.67", "1.74"]; const COAT = ["HC", "HMC", "Blue Cut", "Photochromic", "Polarized"];
const blank = { code: "", name: "", design: "single_vision", segment: "", short_desc: "", base_price: "", mrp: "", tax_pct: "5", features: "", indexes: [] as string[], coatings: [] as string[], sph_min: "", sph_max: "", cyl_max: "", images: [] as string[], status: "active", display_order: "0" };
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;
export function PackagesView({ packages }: { packages: any[] }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [cur, setCur] = useState<any>(null); const [f, setF] = useState<any>(blank);
  useEffect(() => { if (open) setF(cur ? { ...cur, segment: cur.segment ?? "", short_desc: cur.short_desc ?? "", base_price: String(cur.base_price), mrp: cur.mrp ?? "", tax_pct: String(cur.tax_pct), features: cur.features.join("\n"), sph_min: cur.sph_min ?? "", sph_max: cur.sph_max ?? "", cyl_max: cur.cyl_max ?? "", images: cur.images ?? [], display_order: String(cur.display_order) } : blank); }, [open, cur]);
  const n = (s: any) => (String(s).trim() === "" ? null : Number(s)); const tog = (key: "indexes" | "coatings", v: string) => setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x: string) => x !== v) : [...f[key], v] });
  const fileRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null); const [uploading, setUploading] = useState(false);
  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return; setUploading(true); const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 10 - (f.images?.length ?? 0))) added.push(await putImage(await shrink(file, 1400), "product-images"));
      setF({ ...f, images: [...(f.images ?? []), ...added] });
    } catch (e: any) { toast(e?.message ?? "Upload failed — try again.", "err"); } finally { setUploading(false); }
  }
  async function save() { const r = await saveLensPackage({ id: cur?.id, code: f.code, name: f.name, design: f.design, segment: f.segment || null, short_desc: f.short_desc || null, base_price: n(f.base_price), mrp: n(f.mrp), tax_pct: Number(f.tax_pct),
      features: f.features.split("\n").map((x: string) => x.trim()).filter(Boolean), indexes: f.indexes, coatings: f.coatings, sph_min: n(f.sph_min), sph_max: n(f.sph_max), cyl_max: n(f.cyl_max), images: f.images ?? [], status: f.status, display_order: Number(f.display_order || 0) });
    if (r.error) return toast(r.error, "err"); toast(`${r.ok} saved`); router.refresh(); setOpen(false); }
  return (<div className="space-y-4">
    <div className="flex justify-end"><button onClick={() => { setCur(null); setOpen(true); }} className="btn btn-primary"><Plus size={16} />Add lens package</button></div>
    {packages.length === 0 ? <div className="card p-10 text-center text-slate-500">No lens packages yet.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{packages.map((p) => (
      <button key={p.id} onClick={() => { setCur(p); setOpen(true); }} className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between"><p className="font-display text-xl font-semibold">{p.name}</p><Pill tone={p.status === "active" ? "green" : "grey"}>{p.status}</Pill></div>
        <p className="text-xs capitalize text-slate-500">{p.code} | {p.design.replace("_", " ")}{p.segment ? ` | ${p.segment}` : ""}</p>
        <p className="mt-2 text-sm text-slate-600">{p.short_desc}</p><p className="mt-3 text-lg font-bold">from {inr(p.base_price)} {p.mrp && <span className="text-sm font-normal text-slate-400 line-through">{inr(p.mrp)}</span>}</p>
        <div className="mt-2 flex flex-wrap gap-1">{p.indexes.map((i: string) => <Pill key={i} tone="blue">{i}</Pill>)}{p.coatings.map((i: string) => <Pill key={i} tone="purple">{i}</Pill>)}</div></button>))}</div>}
    <Drawer open={open} onClose={() => setOpen(false)} title={cur ? cur.name : "Add lens package"} subtitle="Base starting price. Final price depends on index, coating and power."
      footer={<><button onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button><button onClick={save} className="btn btn-gold">Save package</button></>}>
      <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><L t="Package code *"><input className="field" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></L><L t="Name *"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
        <L t="Lens design"><select className="field" value={f.design} onChange={(e) => setF({ ...f, design: e.target.value })}>{DESIGNS.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}</select></L><L t="Target segment"><input className="field" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} /></L></div>
        <L t={`Short description (${f.short_desc.length}/150)`}><input maxLength={150} className="field" value={f.short_desc} onChange={(e) => setF({ ...f, short_desc: e.target.value })} /></L>
        <div className="grid grid-cols-3 gap-3"><L t="Base price *"><input className="field" inputMode="decimal" value={f.base_price} onChange={(e) => setF({ ...f, base_price: e.target.value })} /></L><L t="MRP"><input className="field" inputMode="decimal" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} /></L>
          <L t="GST %"><select className="field" value={f.tax_pct} onChange={(e) => setF({ ...f, tax_pct: e.target.value })}>{["0", "5", "12", "18"].map((t) => <option key={t}>{t}</option>)}</select></L></div>
        <L t="Highlights (one per line)"><textarea rows={4} className="field" value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} /></L>
        <div><span className="mb-1 block text-xs text-slate-500">Available index</span><div className="flex flex-wrap gap-2">{IDX.map((i) => <button key={i} type="button" onClick={() => tog("indexes", i)} className={`rounded-full border px-3 py-1 text-sm ${f.indexes.includes(i) ? "border-gold-500 bg-amber-50" : "border-slate-200"}`}>{i}</button>)}</div></div>
        <div><span className="mb-1 block text-xs text-slate-500">Coatings</span><div className="flex flex-wrap gap-2">{COAT.map((i) => <button key={i} type="button" onClick={() => tog("coatings", i)} className={`rounded-full border px-3 py-1 text-sm ${f.coatings.includes(i) ? "border-gold-500 bg-amber-50" : "border-slate-200"}`}>{i}</button>)}</div></div>
        <div className="grid grid-cols-3 gap-3"><L t="SPH min"><input className="field" value={f.sph_min} onChange={(e) => setF({ ...f, sph_min: e.target.value })} /></L><L t="SPH max"><input className="field" value={f.sph_max} onChange={(e) => setF({ ...f, sph_max: e.target.value })} /></L><L t="CYL max"><input className="field" value={f.cyl_max} onChange={(e) => setF({ ...f, cyl_max: e.target.value })} /></L></div>
        <div className="grid grid-cols-2 gap-3"><L t="Status"><select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{["active", "draft", "inactive"].map((s) => <option key={s}>{s}</option>)}</select></L><L t="Display order"><input type="number" className="field" value={f.display_order} onChange={(e) => setF({ ...f, display_order: e.target.value })} /></L></div>
        <div>
          <span className="mb-1 block text-xs text-slate-500">Images (optional)</span>
          <div className="grid grid-cols-3 gap-2">
            {(f.images ?? []).map((p: string, i: number) => (
              <div key={p} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                <img src={imgUrl(p)!} alt="" className="h-full w-full object-contain" />
                {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] text-white">Main</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-white/90 p-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
                  {i > 0 && <button type="button" title="Make main" onClick={() => setF({ ...f, images: [p, ...f.images.filter((x: string) => x !== p)] })}><Star size={15} /></button>}
                  <button type="button" title="Remove" onClick={() => setF({ ...f, images: f.images.filter((x: string) => x !== p) })}><Trash2 size={15} className="text-rose-600" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid place-items-center rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 transition hover:bg-slate-50 disabled:opacity-60">
              <UploadCloud className="mb-1" />{uploading ? "Uploading…" : "Add from gallery"}
              <span className="mt-1 text-[11px] text-slate-400">JPG/PNG · auto-resized to 1400px</span>
            </button>
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading} className="grid place-items-center rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 transition hover:bg-slate-50 disabled:opacity-60">
              <UploadCloud className="mb-1" />Take a photo
              <span className="mt-1 text-[11px] text-slate-400">uses device camera</span>
            </button>
          </div>
          <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </div></div>
    </Drawer></div>);
}
