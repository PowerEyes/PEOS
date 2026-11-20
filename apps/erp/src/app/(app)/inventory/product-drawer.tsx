"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer, useToast } from "@poweros/ui";
import { Glasses, Printer, Star, Trash2, UploadCloud, Plus } from "lucide-react";
import { DETAIL_FIELDS, KINDS, dbError, discountPct, inr, marginPct, type Kind } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { imgUrl, shrink } from "@/lib/image";
import { adjustStock, createBrand, saveProduct, setReorder } from "./actions";

const TABS = ["Basic", "Details", "Pricing", "Stock", "Website", "Images", "Display"] as const;
const SECTIONS = [["window", "Window display"], ["counter", "Counter display"], ["wall", "Wall display"], ["shelf", "Shelf"], ["back_store", "Back store"]] as const;
const S = (v: any) => (v == null ? "" : String(v));
export const Switch = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left">
    <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-gold-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span></button>);
const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;

export function ProductDrawer({ open, onClose, product, kind, brands, branches, gst }: { gst: boolean; open: boolean; onClose: () => void; product: any | null; kind: Kind; brands: any[]; branches: any[] }) {
  const router = useRouter(); const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Basic"); const [busy, setBusy] = useState(false); const [f, setF] = useState<any>({});
  const [newBrand, setNewBrand] = useState(""); const [adj, setAdj] = useState<Record<string, { d: string; r: string }>>({});
  const [printAfter, setPrintAfter] = useState(true);
  useEffect(() => { if (!open) return; setTab("Basic"); setAdj({}); setPrintAfter(true);
    setF(product ? { ...product, cost_price: S(product.cost_price), mrp: S(product.mrp), selling_price: S(product.selling_price), tax_pct: S(product.tax_pct), brand_id: product.brand_id ?? "", collection: product.collection ?? "", short_desc: product.short_desc ?? "", description: product.description ?? "", shelf_location: product.shelf_location ?? "" }
      : { kind, brand_id: "", model: "", collection: "", gender: "unisex", status: "active", barcode: "", cost_price: "", mrp: "", selling_price: "", tax_pct: "5", power_eligible: false, visible_on_website: false, featured: false, new_arrival: false, bestseller: false, short_desc: "", description: "", images: [], attrs: {}, opening_branch: branches[0]?.id ?? "", opening_qty: "", on_display: true, display_section: "shelf", shelf_location: "", display_order: 0 }); }, [open, product?.id]);
  const k: Kind = f.kind ?? kind; const set = (p: any) => setF((x: any) => ({ ...x, ...p })); const setA = (key: string, v: any) => setF((x: any) => ({ ...x, attrs: { ...x.attrs, [key]: v } }));
  const n = (s: string) => (String(s).trim() === "" ? null : Number(s));

  async function save() {
    setBusy(true);
    const r = await saveProduct({ id: product?.id, kind: k, brand_id: f.brand_id || null, model: f.model, collection: f.collection || null, gender: f.gender, status: f.status, barcode: f.barcode || null,
      cost_price: n(f.cost_price), mrp: n(f.mrp), selling_price: n(f.selling_price), tax_pct: Number(f.tax_pct || 0), power_eligible: !!f.power_eligible, hsn: f.hsn || null, price_mode: f.price_mode || "inclusive",
      visible_on_website: f.visible_on_website, featured: f.featured, new_arrival: f.new_arrival, bestseller: f.bestseller, short_desc: f.short_desc || null, description: f.description || null,
      on_display: !!f.on_display, display_section: f.display_section || "shelf", shelf_location: f.shelf_location || null, display_order: Number(f.display_order) || 0,
      images: f.images, attrs: f.attrs, opening: !product && Number(f.opening_qty) > 0 ? { branch_id: f.opening_branch, qty: Number(f.opening_qty) } : undefined });
    setBusy(false); if (r.error) return toast(r.error, "err");
    if (!product && printAfter && r.id) window.open(`/print/labels?ids=${r.id}&copies=1`, "_blank");
    toast(product ? "Product saved" : `Product ${r.ok} created`); router.refresh(); onClose(); }
  async function upload(files: FileList | null) {
    if (!files) return; const sb = supabaseBrowser(); const { data: { user } } = await sb.auth.getUser(); const { data: p } = await sb.from("profiles").select("org_id").eq("id", user?.id ?? "").single(); const org = p?.org_id; const added: string[] = [];
    for (const file of Array.from(files).slice(0, 10 - f.images.length)) {
      if (!org) { toast("No organisation on your profile — can't upload.", "err"); return; }
      const path = `${org}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("product-images").upload(path, await shrink(file, 1400), { contentType: "image/jpeg" });
      error ? toast(dbError(error.message), "err") : added.push(path);
    }
    set({ images: [...f.images, ...added] }); }
  async function addBrand() { const r = await createBrand(newBrand); if (r.error) return toast(r.error, "err"); toast(`Brand ${r.ok} added`); setNewBrand(""); set({ brand_id: r.id }); router.refresh(); }
  async function apply(branch_id: string) { const a = adj[branch_id]; const r = await adjustStock({ product_id: product.id, branch_id, delta: Number(a?.d), reason: a?.r || "adjustment" });
    if (r.error) return toast(r.error, "err"); toast(r.ok!); setAdj((x) => ({ ...x, [branch_id]: { d: "", r: "adjustment" } })); router.refresh(); }

  const margin = marginPct(n(f.cost_price), n(f.selling_price)), disc = discountPct(n(f.mrp), n(f.selling_price));
  const title = product ? `${product.brands?.name ?? ""} ${product.model}`.trim() : `Add ${KINDS.find((x) => x.key === k)?.label.toLowerCase()}`;
  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={product ? `${product.sku} | ${product.barcode}` : "SKU and barcode are generated on save"}
      footer={<><button onClick={onClose} className="btn btn-ghost">Cancel</button>{product ? <a href={`/print/labels?ids=${product.id}&copies=1`} target="_blank" rel="noreferrer" className="btn btn-ghost"><Printer size={15} />Label</a> : <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="h-3.5 w-3.5 accent-navy-700" />Print label</label>}
{tab !== "Basic" && <button type="button" onClick={() => { const idx = TABS.indexOf(tab); if (idx > 0) setTab(TABS[idx - 1]); }} className="btn btn-ghost">← Back</button>}
<button disabled={busy} onClick={() => {
  const idx = TABS.indexOf(tab);
  if (idx < TABS.length - 1) { setTab(TABS[idx + 1]); return; }
  save();
}} className="btn btn-gold">{busy ? "Saving…" : (TABS.indexOf(tab) < TABS.length - 1 ? "Next →" : `Save ${KINDS.find((x) => x.key === k)?.label ?? "product"}`)}</button></>}>
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-5 mb-4 flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 sm:px-4">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3 py-3 text-sm font-medium ${tab === t ? "border-b-2 border-gold-500 text-navy-900" : "text-slate-500"}`}>{t}</button>)}</div>
      <div className="space-y-3">
        {tab === "Basic" && <>
          <div className="grid gap-3 sm:grid-cols-2"><L t="Brand"><select className="field" value={f.brand_id ?? ""} onChange={(e) => set({ brand_id: e.target.value })}><option value="">-</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
            <L t="Model *"><input className="field" value={f.model ?? ""} onChange={(e) => set({ model: e.target.value })} /></L></div>
          <div className="flex gap-2"><input className="field" placeholder="Not listed? Add a new brand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} /><button onClick={addBrand} className="btn btn-ghost"><Plus size={15} />Add</button></div>
          <div className="grid gap-3 sm:grid-cols-3"><L t="Collection"><input className="field" value={f.collection ?? ""} onChange={(e) => set({ collection: e.target.value })} /></L>
            <L t="Gender"><select className="field" value={f.gender} onChange={(e) => set({ gender: e.target.value })}>{["men", "women", "unisex", "kids"].map((g) => <option key={g} value={g} className="capitalize">{g}</option>)}</select></L>
            <L t="Status"><select className="field" value={f.status} onChange={(e) => set({ status: e.target.value })}>{["active", "draft", "inactive"].map((g) => <option key={g}>{g}</option>)}</select></L></div>
          <div className="grid gap-3 sm:grid-cols-2"><L t="HSN code"><input className="field" placeholder="900311 frames • 900150 lenses • 900410 sunglasses • 900130 CL" value={f.hsn ?? ""} onChange={(e) => setF({ ...f, hsn: e.target.value })} /></L><L t="Price mode"><select className="field" value={f.price_mode ?? "inclusive"} onChange={(e) => setF({ ...f, price_mode: e.target.value })}><option value="inclusive">GST Inclusive (price includes GST)</option><option value="exclusive">GST Exclusive (GST added on top)</option></select></L></div><L t="Barcode"><input className="field" placeholder="Auto-generated from the SKU if empty" value={f.barcode ?? ""} onChange={(e) => set({ barcode: e.target.value })} /></L>
          {(k === "frame" || k === "sunglass") && <Switch on={!!f.power_eligible} set={(v) => set({ power_eligible: v })} label="Eligible for power glass" hint={f.power_eligible ? "Cards, lists and the product page show Choose Lens" : "Cards, lists and the product page show Add to Bag"} />}</>}
        {tab === "Details" && <div className="grid gap-3 sm:grid-cols-2">{DETAIL_FIELDS[k].map((d) => d.type === "multi" ? (
          <div key={d.key} className="sm:col-span-2"><span className="mb-1 block text-xs text-slate-500">{d.label}</span><div className="flex flex-wrap gap-2">{d.options!.map((o) => { const on = (f.attrs?.[d.key] ?? []).includes(o);
            return <button key={o} type="button" onClick={() => setA(d.key, on ? f.attrs[d.key].filter((x: string) => x !== o) : [...(f.attrs?.[d.key] ?? []), o])} className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-gold-500 bg-amber-50 text-gold-600" : "border-slate-200"}`}>{o}</button>; })}</div></div>) : (
          <L key={d.key} t={d.unit ? `${d.label} (${d.unit})` : d.label}>{d.type === "select" ? <select className="field" value={f.attrs?.[d.key] ?? ""} onChange={(e) => setA(d.key, e.target.value)}><option value="">-</option>{d.options!.map((o) => <option key={o}>{o}</option>)}</select>
            : <input className="field" type={d.type} step="any" value={f.attrs?.[d.key] ?? ""} onChange={(e) => setA(d.key, d.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />}</L>))}</div>}
        {tab === "Pricing" && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><L t="Cost price"><input className="field" inputMode="decimal" value={f.cost_price} onChange={(e) => set({ cost_price: e.target.value })} /></L>
          <L t="MRP"><input className="field" inputMode="decimal" value={f.mrp} onChange={(e) => set({ mrp: e.target.value })} /></L>
          <L t="Selling price (incl. tax) *"><input className="field" inputMode="decimal" value={f.selling_price} onChange={(e) => set({ selling_price: e.target.value })} /></L>
          <L t={gst ? "GST %" : "GST % (GST is switched off)"}><select disabled={!gst} className="field" value={f.tax_pct} onChange={(e) => set({ tax_pct: e.target.value })}>{["0", "5", "12", "18", "28"].map((t) => <option key={t}>{t}</option>)}</select></L></div>
          <p className="rounded-xl bg-navy-50 p-3 text-sm">{inr(n(f.selling_price)) || "Enter a selling price"}{disc ? ` | ${disc}% off MRP` : ""}{margin != null ? ` | ${margin}% margin` : ""}</p></>}
        {tab === "Stock" && (product ? <div className="space-y-3">{branches.map((b) => { const row = product.stock?.find((s: any) => s.branch_id === b.id); const a = adj[b.id] ?? { d: "", r: "adjustment" };
          return <div key={b.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><p className="font-semibold">{b.name}</p><p className="text-2xl font-bold">{row?.qty ?? 0}</p></div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] items-end gap-2"><L t="Change (+/-)"><input type="number" className="field py-2" value={a.d} onChange={(e) => setAdj({ ...adj, [b.id]: { ...a, d: e.target.value } })} /></L>
              <L t="Reason"><select className="field py-2" value={a.r} onChange={(e) => setAdj({ ...adj, [b.id]: { ...a, r: e.target.value } })}>{["purchase", "adjustment", "damage", "return", "transfer_in", "transfer_out"].map((r) => <option key={r}>{r}</option>)}</select></L>
              <button onClick={() => apply(b.id)} className="btn btn-primary !py-2.5">Apply</button></div>
            <div className="mt-2"><L t="Reorder level"><input type="number" min={0} className="field py-2" defaultValue={row?.reorder_level ?? 0} onBlur={async (e) => { const r = await setReorder(product.id, b.id, Number(e.target.value)); r.error ? toast(r.error, "err") : router.refresh(); }} /></L></div></div>; })}</div>
          : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><L t="Opening branch"><select className="field" value={f.opening_branch} onChange={(e) => set({ opening_branch: e.target.value })}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
            <L t="Opening stock"><input type="number" min={0} className="field" value={f.opening_qty} onChange={(e) => set({ opening_qty: e.target.value })} /></L></div>)}
        {tab === "Website" && <><Switch on={f.visible_on_website} set={(v) => set({ visible_on_website: v })} label="Visible on website" hint="Shown on the public shop when the product is active" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{([["featured", "Featured"], ["new_arrival", "New"], ["bestseller", "Best seller"]] as const).map(([key, lab]) => <Switch key={key} on={f[key]} set={(v) => set({ [key]: v })} label={lab} />)}</div>
          <L t={`Short description (${(f.short_desc ?? "").length}/200)`}><input className="field" maxLength={200} value={f.short_desc ?? ""} onChange={(e) => set({ short_desc: e.target.value })} /></L>
          <L t="Description"><textarea rows={5} maxLength={2000} className="field" value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></L></>}
        {tab === "Images" && <><div className="grid grid-cols-3 gap-2">{(f.images ?? []).map((p: string, i: number) => <div key={p} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          <img src={imgUrl(p)} alt="" className="h-full w-full object-contain" />{i === 0 && <span className="absolute left-1 top-1 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] text-white">Main</span>}
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-white/90 p-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
            {i > 0 && <button title="Make main" onClick={() => set({ images: [p, ...f.images.filter((x: string) => x !== p)] })}><Star size={15} /></button>}<button title="Remove" onClick={() => set({ images: f.images.filter((x: string) => x !== p) })}><Trash2 size={15} className="text-rose-600" /></button></div></div>)}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="grid place-items-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 transition hover:bg-slate-50"><UploadCloud className="mb-1" />Add from gallery (JPG/PNG, up to 10)
              <span className="mt-1 text-[11px] text-slate-400">auto-resized to 1400px</span></button>
            <button type="button" onClick={() => cameraRef.current?.click()} className="grid place-items-center rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 transition hover:bg-slate-50"><UploadCloud className="mb-1" />Take a photo (camera)
              <span className="mt-1 text-[11px] text-slate-400">uses device camera</span></button>
          </div>
          <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          {(f.images ?? []).length === 0 && <p className="flex items-center gap-2 text-sm text-slate-500"><Glasses size={16} />Products without photos show a placeholder.</p>}</>}
        {tab === "Display" && <><Switch on={!!f.on_display} set={(v) => set({ on_display: v })} label="On display" hint="Off = kept in back store / not placed on the sales floor" />
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Display section"><select className="field" value={f.display_section ?? "shelf"} onChange={(e) => set({ display_section: e.target.value })}>{SECTIONS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}</select></L>
            <L t="Shelf location"><input className="field" placeholder="e.g. Rack A-2, Row 1" value={f.shelf_location ?? ""} onChange={(e) => set({ shelf_location: e.target.value })} /></L></div>
          <L t="Display order"><input type="number" min={0} className="field" value={f.display_order ?? 0} onChange={(e) => set({ display_order: e.target.value === "" ? 0 : Number(e.target.value) })} /></L>
          <p className="rounded-xl bg-navy-50 p-3 text-sm text-slate-600">Placement is shared with the <b>Display &amp; Shelf</b> inventory tab, where you can update it for all products at once.</p></>}
      </div>
    </Drawer>);
}
