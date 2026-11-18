"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { Globe, Megaphone, Star, BarChart3, Plus, Eye, EyeOff, Pencil, Trash2, ExternalLink, GripVertical, ImagePlus, Maximize2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { siteImgUrl } from "@/lib/image";
import { ImageField } from "@/components/ImageField";
import { BulkUploadModal } from "@/components/BulkUploadModal";

const TABS = ["Homepage","Sections","Products","Reviews","Analytics"] as const;
// Fallback only — used if website_sections is empty (a fresh env that hasn't run
// 0023). Normally the list is DB-driven so order/visibility is editable in the
// ERP instead of requiring a redeploy.
const SECTION_FALLBACK = ["announcement","site_logo","nav","hero","category_card","frame_finder","shape_chip","best_seller","collection_banner","lens_type","lifestyle_chip","feature_card","stores","promo","top_sunglasses","ugc","whatsapp_cta","footer","lenses_guide"];
// Sections whose rows are singletons/chrome rather than repeated cards — their
// images are optional, and the empty state explains what the image is for.
const SECTION_HINT: Record<string, string> = {
  hero: "21:9 background image. Leave empty to keep the gradient.",
  site_logo: "Square logo. Leave empty to keep the eye mark.",
  announcement: "Optional banner image behind the text.",
  ugc: "1:1 customer photo. Leave empty to keep the placeholder tile.",
  promo: "Banner image behind the call-to-action.",
  collection_banner: "4:3 image for this banner card.",
  category_card: "4:3 image. Leave empty to keep the emoji.",
  stores: "Storefront photo for this card.",
};
// Section-level images (edited in the Sections tab) preview at the ratio the
// site crops to. Everything else defaults to 4:3.
const SECTION_ASPECT: Record<string, string> = { hero: "aspect-[21/9]", site_logo: "aspect-square" };

/** section → row ids in display_order, so a drag always starts from what's on screen. */
function groupIds(rows: any[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const sorted = [...rows].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.id).localeCompare(String(b.id)),
  );
  for (const r of sorted) (out[r.section] ??= []).push(r.id);
  return out;
}
const sectionColor: any = { hero:"blue",announcement:"gold",collection_banner:"green",lenses_guide:"purple",promo:"rose" };
const pillTone: any = { hero:"blue",announcement:"gold",collection_banner:"green",lenses_guide:"purple",promo:"red" };

// Empty form — image fields start null so a brand-new row never writes "".
const blank = {
  section:"hero", key:"", parent_key:"", title:"", subtitle:"", body:"", link:"",
  cta_label:"", cta_link:"", badge:"", bg_color:"", icon:"",
  image_path:null as string|null, image_alt:"",
  display_order:"1", is_active:true, valid_from:"", valid_until:"",
};
const L = ({ t, children }: { t: string; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;

function ContentRow({ item, onEdit, onToggle, onDelete }: { item: any; onEdit: ()=>void; onToggle: ()=>void; onDelete: ()=>void }) {
  const src = siteImgUrl(item.image_path);
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
      {/* hero / feature_card / footer nest rows under a parent_key. The drag
          list stays flat (drag has to be), so indent the children — otherwise a
          checklist item reads as a sibling of the card that contains it. */}
      {item.parent_key && <span className="w-3 shrink-0" aria-hidden />}
      {/* Drag affordance — the whole row is draggable, this just says so. */}
      <GripVertical size={14} className="-ml-1 shrink-0 cursor-grab text-slate-300"/>
      {/* Thumbnail (or the emoji fallback) so a row is recognisable at a glance. */}
      {src
        ? <img src={src} alt={item.image_alt||""} className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover"/>
        : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-lg" title="No image yet">{item.icon||"🖼️"}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{item.title||"(no title)"}</span>
        <span className="flex items-center gap-2 mt-0.5"><Pill tone={pillTone[item.section]||"grey"}>{item.section.replace("_"," ")}</Pill><span className="text-xs text-slate-400">Order {item.display_order}</span>{item.key&&<span className="font-mono text-[10px] text-slate-400">{item.key}</span>}{item.parent_key&&<span className="rounded bg-slate-100 px-1 py-px text-[10px] text-slate-500" title="Nested under this parent card">↳ {item.parent_key}</span>}</span>
      </span>
      <div className="flex items-center gap-1">
        {item.link && <a href={item.link} target="_blank" className="rounded-lg p-1.5 hover:bg-slate-100"><ExternalLink size={14} className="text-slate-400"/></a>}
        <button onClick={onToggle} className="rounded-lg p-1.5 hover:bg-slate-100">{item.is_active ? <Eye size={14} className="text-emerald-600"/> : <EyeOff size={14} className="text-slate-400"/>}</button>
        <button onClick={onEdit} className="rounded-lg p-1.5 hover:bg-slate-100"><Pencil size={14} className="text-slate-500"/></button>
        <button onClick={onDelete} className="rounded-lg p-1.5 hover:bg-slate-100"><Trash2 size={14} className="text-rose-500"/></button>
      </div>
    </div>);
}

export function WebsiteController({ content, products, reviews, sections, siteUrl, previewKey }: {
  content: any[]; products: any[]; reviews: any[]; sections: any[];
  /** public origin of the website, e.g. http://localhost:3000 */
  siteUrl: string;
  /** SITE_PREVIEW_KEY, or null when the server hasn't configured one */
  previewKey: string | null;
}) {
  const router = useRouter(); const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Homepage");
  const [editItem, setEditItem] = useState<any>(null); const [addOpen, setAddOpen] = useState(false);
  const [f, setF] = useState<any>({ ...blank });
  const [busy, setBusy] = useState(false);
  // Sections registry — `secs` mirrors the server rows and is the drag source.
  const [secs, setSecs] = useState<any[]>(sections);
  const [editSec, setEditSec] = useState<any>(null); const [sf, setSf] = useState<any>(null);
  const [order, setOrder] = useState<string[]>(sections.map(s => s.key));
  // Reorder.Item's onDragEnd is created at drag start, so it would otherwise
  // capture a stale order. Read the live value through a ref.
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);
  useEffect(() => { setSecs(sections); setOrder(sections.map(s => s.key)); }, [sections]);
  // Card order inside each section — same stale-closure problem, same fix.
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>(() => groupIds(content));
  const cardOrderRef = useRef(cardOrder);
  useEffect(() => { cardOrderRef.current = cardOrder; }, [cardOrder]);
  // Rebuilt whenever the server rows change, so a row added elsewhere (or an
  // undo after a failed save) converges instead of fighting the local order.
  useEffect(() => { setCardOrder(groupIds(content)); }, [content]);
  // Bulk upload + live preview targets.
  const [bulkFor, setBulkFor] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pvHidden, setPvHidden] = useState(true);
  const [previewNonce, setPreviewNonce] = useState(0);
  useEffect(() => { if (editItem) setF({ ...blank, ...editItem, valid_from: editItem.valid_from??"", valid_until: editItem.valid_until??"", image_path: editItem.image_path??null, image_alt: editItem.image_alt??"", key: editItem.key??"", parent_key: editItem.parent_key??"", icon: editItem.icon??"" }); }, [editItem?.id]);
  useEffect(() => { if (editSec) setSf({ ...editSec, title: editSec.title??"", subtitle: editSec.subtitle??"", image_path: editSec.image_path??null, image_alt: editSec.image_alt??"", bg_color: editSec.bg_color??"", cta_label: editSec.cta_label??"", cta_link: editSec.cta_link??"" }); }, [editSec?.id]);
  const sb = supabaseBrowser;

  const byKey = useMemo(() => new Map(sections.map((s: any) => [s.key, s])), [sections]);
  // Registry keys in display order, then any section a content row references
  // that isn't registered — so a stray key can't make rows unreachable.
  const sectionKeys = useMemo(() => {
    const known = sections.map((s: any) => s.key);
    const extra = [...new Set(content.map((c: any) => c.section))].filter(s => !known.includes(s));
    return [...known, ...extra];
  }, [sections, content]);

  // Rows of one section in the order the user is currently dragging them in.
  // Rows that arrived since the last sync (not yet in cardOrder) append, so a
  // freshly saved card can never be dropped from the list.
  const itemsOf = (sec: string): any[] => {
    const rows = content.filter((c: any) => c.section === sec);
    const byId = new Map(rows.map((c: any) => [c.id, c]));
    const ids = cardOrder[sec];
    if (!ids) return rows;
    const ordered: any[] = [];
    for (const id of ids) { const r = byId.get(id); if (r) ordered.push(r); }
    for (const r of rows) if (!ids.includes(r.id)) ordered.push(r);
    return ordered;
  };

  // First free display_order in whichever section the bulk modal targets.
  const bulkStart = useMemo(() => {
    if (!bulkFor) return 1;
    const orders = content.filter((c: any) => c.section === bulkFor).map((c: any) => Number(c.display_order) || 0);
    return (orders.length ? Math.max(...orders) : 0) + 1;
  }, [bulkFor, content]);

  // Live-preview iframe source. The `_` nonce forces a reload without touching
  // the origin — necessary because the ERP can't reach into a cross-origin
  // frame to call location.reload().
  const previewSrc = useMemo(() => {
    const base = (siteUrl || "http://localhost:3000").replace(/\/+$/, "");
    const q = pvHidden && previewKey ? `/?preview=1&k=${encodeURIComponent(previewKey)}` : "/";
    return `${base}${q}${q.includes("?") ? "&" : "?"}_=${previewNonce}`;
  }, [siteUrl, pvHidden, previewKey, previewNonce]);

  // Writes display_order for every row whose index actually moved.
  async function persistOrder(newOrder: string[]) {
    const moved = newOrder.map((k, i) => ({ sec: byKey.get(k), i }))
      .filter(({ sec, i }) => sec && sec.display_order !== i + 1);
    if (!moved.length) return;
    setBusy(true);
    const results = await Promise.all(moved.map(({ sec, i }) =>
      sb().from("website_sections").update({ display_order: i + 1 }).eq("id", sec.id)));
    setBusy(false);
    const err = results.find(r => r.error);
    if (err) { toast(err.error!.message, "err"); router.refresh(); return; } // revert to server order
    toast("Section order saved");
    router.refresh();
  }

  // Writes display_order for every card whose position actually moved within
  // its section. Ordering is scoped per section (the site sorts by section,
  // then display_order), so renumbering 1..N here can't disturb another group.
  async function persistCardOrder(sec: string, ids: string[]) {
    const byId = new Map(content.filter((c: any) => c.section === sec).map((c: any) => [c.id, c]));
    const moved = ids.map((id, i) => ({ row: byId.get(id), i }))
      .filter(({ row, i }) => row && row.display_order !== i + 1);
    if (!moved.length) return;
    setBusy(true);
    const results = await Promise.all(moved.map(({ row, i }) =>
      sb().from("website_content").update({ display_order: i + 1 }).eq("id", row.id)));
    setBusy(false);
    const err = results.find(r => r.error);
    if (err) { toast(err.error!.message, "err"); router.refresh(); return; } // revert to server order
    toast("Card order saved");
    router.refresh();
  }

  async function toggleSec(sec: any) {
    const next = !sec.enabled;
    // Optimistic — the prop refresh below converges (or reverts on error).
    setSecs(s => s.map(x => x.key === sec.key ? { ...x, enabled: next } : x));
    const { error } = await sb().from("website_sections").update({ enabled: next }).eq("id", sec.id);
    if (error) toast(error.message, "err");
    router.refresh();
  }

  async function saveSection() {
    setBusy(true);
    const nz = (v: any) => (v === "" || v == null ? null : v);
    // `key` is deliberately absent — it's the identity content rows reference.
    const row = { title: nz(sf.title), subtitle: nz(sf.subtitle), image_path: nz(sf.image_path),
      image_alt: nz(sf.image_alt), bg_color: nz(sf.bg_color), cta_label: nz(sf.cta_label),
      cta_link: nz(sf.cta_link), enabled: !!sf.enabled };
    const { error } = await sb().from("website_sections").update(row).eq("id", editSec.id);
    setBusy(false); if (error) return toast(error.message, "err");
    toast("Section updated"); router.refresh(); setEditSec(null);
  }

  const openContent = (item?: any) => { setEditSec(null); if (item) setEditItem(item); else { setF({ ...blank }); setAddOpen(true); } };
  const openSection = (sec: any) => { setAddOpen(false); setEditItem(null); setEditSec(sec); };
  const closeDrawer = () => { setAddOpen(false); setEditItem(null); setEditSec(null); };

  async function saveContent() {
    setBusy(true);
    // Empty string → NULL: `key` is unique per section, so two rows left with
    // key:"" would collide on website_content_key_uniq (0023).
    const nz = (v: any) => (v === "" || v == null ? null : v);
    const row = { ...f,
      key: nz(f.key), parent_key: nz(f.parent_key), icon: nz(f.icon),
      image_path: nz(f.image_path), image_alt: nz(f.image_alt),
      display_order: Number(f.display_order||1), valid_from: f.valid_from||null, valid_until: f.valid_until||null };
    const { error } = editItem ? await sb().from("website_content").update(row).eq("id", editItem.id) : await sb().from("website_content").insert(row);
    setBusy(false); if (error) return toast(error.message,"err"); toast(editItem?"Updated":"Created"); router.refresh(); setEditItem(null); setAddOpen(false);
  }
  async function toggleContent(item: any) {
    await sb().from("website_content").update({ is_active: !item.is_active }).eq("id", item.id); router.refresh();
  }
  async function deleteContent(id: string) {
    if (!confirm("Delete this content?")) return; await sb().from("website_content").delete().eq("id", id); router.refresh(); toast("Deleted");
  }
  async function toggleProduct(id: string, field: string, val: boolean) {
    await sb().from("products").update({ [field]: !val }).eq("id", id); router.refresh();
  }
  async function approveReview(id: string) { await sb().from("product_reviews").update({ status:"approved" }).eq("id",id); router.refresh(); toast("Review approved"); }
  async function rejectReview(id: string) { await sb().from("product_reviews").update({ status:"rejected" }).eq("id",id); router.refresh(); toast("Review rejected"); }

  const ContentForm = (<div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="Section"><select className="field" value={f.section} onChange={e=>setF({...f,section:e.target.value})}>{sectionKeys.map(s=><option key={s}>{s}</option>)}</select></L>
      <L t="Display order"><input type="number" className="field" value={f.display_order} onChange={e=>setF({...f,display_order:e.target.value})}/></L>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="Key (stable id, unique within section)"><input className="field font-mono" value={f.key} onChange={e=>setF({...f,key:e.target.value})} placeholder="e.g. banner_new"/></L>
      <L t="Parent key (group under another row)"><input className="field font-mono" value={f.parent_key} onChange={e=>setF({...f,parent_key:e.target.value})} placeholder="e.g. col_shop"/></L>
    </div>
    <L t="Title"><input className="field" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></L>
    <L t="Subtitle"><input className="field" value={f.subtitle} onChange={e=>setF({...f,subtitle:e.target.value})}/></L>
    <L t="Body text"><textarea className="field" rows={3} value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></L>

    <ImageField
      value={f.image_path}
      onChange={(p)=>setF((x:any)=>({...x,image_path:p}))}
      alt={f.image_alt}
      onAltChange={(v)=>setF((x:any)=>({...x,image_alt:v}))}
      hint={SECTION_HINT[f.section] ?? "Optional. Leave empty to keep the section's default emoji/gradient look."}
      crop
    />

    <L t="Icon / emoji fallback (shown when there's no image)"><input className="field" value={f.icon} onChange={e=>setF({...f,icon:e.target.value})} placeholder="🕶️"/></L>
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="CTA label"><input className="field" value={f.cta_label} onChange={e=>setF({...f,cta_label:e.target.value})} placeholder="Shop Now"/></L>
      <L t="CTA link"><input className="field" value={f.cta_link} onChange={e=>setF({...f,cta_link:e.target.value})} placeholder="/eyeglasses"/></L>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="Badge text"><input className="field" value={f.badge} onChange={e=>setF({...f,badge:e.target.value})} placeholder="New Arrival"/></L>
      <L t="Background colour"><input className="field" value={f.bg_color} onChange={e=>setF({...f,bg_color:e.target.value})} placeholder="from-navy-900 to-navy-800"/></L>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="Valid from"><input type="date" className="field" value={f.valid_from} onChange={e=>setF({...f,valid_from:e.target.value})}/></L>
      <L t="Valid until"><input type="date" className="field" value={f.valid_until} onChange={e=>setF({...f,valid_until:e.target.value})}/></L>
    </div>
    <button type="button" role="switch" onClick={()=>setF({...f,is_active:!f.is_active})} className={`flex w-full items-center justify-between rounded-xl border p-3 ${f.is_active?"border-emerald-200 bg-emerald-50":"border-slate-100"}`}>
      <span className="text-sm font-medium">{f.is_active?"Visible on website":"Hidden from website"}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${f.is_active?"bg-emerald-500":"bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.is_active?"left-[22px]":"left-0.5"}`}/></span>
    </button>
  </div>);

  const SectionForm = editSec && sf && (<div className="space-y-3">
    <L t="Key (read-only — content rows reference this)"><input className="field cursor-not-allowed bg-slate-50 font-mono text-slate-500" value={sf.key} readOnly/></L>
    <L t="Heading"><input className="field" value={sf.title} onChange={e=>setSf({...sf,title:e.target.value})} placeholder="Best Sellers"/></L>
    <L t="Subheading"><input className="field" value={sf.subtitle} onChange={e=>setSf({...sf,subtitle:e.target.value})} placeholder="Most loved frames by our customers"/></L>
    <ImageField
      value={sf.image_path}
      onChange={(p)=>setSf((x:any)=>({...x,image_path:p}))}
      alt={sf.image_alt}
      onAltChange={(v)=>setSf((x:any)=>({...x,image_alt:v}))}
      aspect={SECTION_ASPECT[sf.key] ?? "aspect-[4/3]"}
      crop
      hint="Shown behind or above this whole block. Leave empty to keep the section's default look."
    />
    <div className="grid gap-3 sm:grid-cols-2">
      <L t="CTA label"><input className="field" value={sf.cta_label} onChange={e=>setSf({...sf,cta_label:e.target.value})} placeholder="View All"/></L>
      <L t="CTA link"><input className="field" value={sf.cta_link} onChange={e=>setSf({...sf,cta_link:e.target.value})} placeholder="/eyeglasses"/></L>
    </div>
    <L t="Background colour (tailwind gradient classes)"><input className="field" value={sf.bg_color} onChange={e=>setSf({...sf,bg_color:e.target.value})} placeholder="from-navy-900 to-navy-800"/></L>
    <button type="button" role="switch" aria-checked={!!sf.enabled} onClick={()=>setSf({...sf,enabled:!sf.enabled})} className={`flex w-full items-center justify-between rounded-xl border p-3 ${sf.enabled?"border-emerald-200 bg-emerald-50":"border-slate-100"}`}>
      <span className="text-sm font-medium">{sf.enabled?"Section visible on website":"Section hidden from website"}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${sf.enabled?"bg-emerald-500":"bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sf.enabled?"left-[22px]":"left-0.5"}`}/></span>
    </button>
  </div>);

  return (<div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-end justify-between">
      <div><h1 className="font-display text-3xl font-semibold">Website Controller</h1>
        <p className="text-slate-500">Manage public website content — changes appear instantly</p></div>
      <div className="flex items-center gap-2">
        <button onClick={()=>setPreviewOpen(true)} className="btn btn-ghost text-sm"><Maximize2 size={15}/>Live preview</button>
        <a href={siteUrl||process.env.NEXT_PUBLIC_WEB_URL||"http://localhost:3000"} target="_blank" className="btn btn-ghost text-sm"><Globe size={15}/>View website</a>
      </div>
    </div>
    <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm overflow-x-auto">
      {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab===t?"text-white":"text-slate-600"}`}>
        {tab===t&&<motion.span layoutId="wtab" className="absolute inset-0 rounded-xl bg-navy-800"/>}<span className="relative">{t}</span></button>)}</div>

    <AnimatePresence mode="wait"><motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.15}}>
      {tab==="Homepage"&&(<div className="space-y-4">
        <div className="flex justify-end"><button onClick={()=>openContent()} className="btn btn-primary"><Plus size={16}/>Add content</button></div>
        {sectionKeys.map(sec=>{const items=itemsOf(sec); const ids=items.map((x:any)=>x.id); const meta=byKey.get(sec);
          return(<div key={sec} className={`card overflow-hidden ${meta&&!meta.enabled?"opacity-70":""}`}>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wider">{(meta?.title||sec).replace("_"," ")}</span>
              <span className="text-xs font-normal text-slate-400">({items.length})</span>
              {meta&&!meta.enabled&&<Pill tone="red">Hidden</Pill>}
              <span className="flex-1"/>
              <button title="Bulk-upload images into this section" onClick={()=>setBulkFor(sec)} className="rounded-lg p-1.5 hover:bg-slate-100"><ImagePlus size={14} className="text-slate-500"/></button>
              {meta&&<>
                <button title={meta.enabled?"Hide this whole section":"Show this section"} onClick={()=>toggleSec(meta)} className="rounded-lg p-1.5 hover:bg-slate-100">
                  {meta.enabled?<Eye size={14} className="text-emerald-600"/>:<EyeOff size={14} className="text-slate-400"/>}</button>
                <button title="Edit section settings" onClick={()=>openSection(meta)} className="rounded-lg p-1.5 hover:bg-slate-100"><Pencil size={14} className="text-slate-500"/></button></>}
            </div>
            {items.length===0
              ? <p className="px-4 py-3 text-xs text-slate-400">No content yet. Add one above, or drop a batch of images in with the button top-right.</p>
              : <Reorder.Group as="div" axis="y" values={ids}
                  onReorder={(v)=>setCardOrder(o=>({...o,[sec]:v as string[]}))}
                  className="divide-y divide-slate-100">
                  {ids.map((id,n)=>{const item=items[n]; return (
                    <Reorder.Item as="div" key={id} value={id}
                      onDragEnd={()=>void persistCardOrder(sec, cardOrderRef.current[sec] ?? ids)}
                      className="bg-white">
                      <ContentRow item={item} onEdit={()=>openContent(item)} onToggle={()=>toggleContent(item)} onDelete={()=>deleteContent(item.id)}/>
                    </Reorder.Item>);})}
                </Reorder.Group>}
          </div>);})}
      </div>)}

      {tab==="Sections"&&(<div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Drag to reorder how blocks stack on the homepage. The eye hides a block entirely — its content rows stay editable here.</p>
          <span className="shrink-0 text-xs text-slate-400">{secs.filter(s=>s.enabled).length} of {secs.length} visible</span>
        </div>
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="card divide-y divide-slate-100 overflow-hidden">
          {order.map(k=>{const sec=byKey.get(k); if(!sec) return null;
            const count=content.filter(c=>c.section===k).length; const src=siteImgUrl(sec.image_path);
            return (
              <Reorder.Item key={k} value={k} onDragEnd={()=>persistOrder(orderRef.current)}
                className={`flex items-center gap-3 bg-white px-4 py-3 hover:bg-slate-50 ${sec.enabled?"":"opacity-60"}`}>
                <GripVertical size={16} className="shrink-0 cursor-grab text-slate-300"/>
                {src
                  ? <img src={src} alt={sec.image_alt||""} className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover"/>
                  : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-lg" title="No image yet">🖼️</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{sec.title||k}</span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{k}</span>
                    <span className="text-xs text-slate-400">{count} row{count===1?"":"s"}</span>
                    {sec.cta_label&&<span className="truncate text-xs text-slate-400">{sec.cta_label} → {sec.cta_link}</span>}
                  </span>
                </span>
                {!sec.enabled&&<Pill tone="red">Hidden</Pill>}
                <button title={sec.enabled?"Hide this section":"Show this section"} onClick={()=>toggleSec(sec)} className="rounded-lg p-1.5 hover:bg-slate-100">
                  {sec.enabled?<Eye size={16} className="text-emerald-600"/>:<EyeOff size={16} className="text-slate-400"/>}</button>
                <button title="Edit section" onClick={()=>openSection(sec)} className="rounded-lg p-1.5 hover:bg-slate-100"><Pencil size={16} className="text-slate-500"/></button>
              </Reorder.Item>);})}
        </Reorder.Group>
        {secs.length===0&&<div className="card p-10 text-center text-sm text-slate-500">No sections registered yet.</div>}
      </div>)}

      {tab==="Products"&&(<div className="space-y-3">
        <p className="text-sm text-slate-500">Toggle visibility and badges per product. Full editing is in Inventory.</p>
        <div className="card divide-y divide-slate-100 overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500"><span>Product</span><span className="text-center">Visible</span><span className="text-center">Featured</span><span className="text-center">New</span><span className="text-center">Best</span></div>
          {products.map(p=>(
            <div key={p.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
              <span className="min-w-0"><span className="block truncate font-medium">{p.model}</span><span className="text-xs text-slate-400">{p.sku}</span></span>
              {[["visible_on_website",p.visible_on_website,"emerald"],["featured",p.featured,"blue"],["new_arrival",p.new_arrival,"violet"],["bestseller",p.bestseller,"gold"]].map(([field,val,c])=>(
                <button key={field as string} onClick={()=>toggleProduct(p.id,field as string,val as boolean)} className={`mx-auto flex h-6 w-12 items-center rounded-full transition ${val?`bg-${c}-500`:"bg-slate-200"}`}>
                  <span className={`h-5 w-5 rounded-full bg-white shadow transition-all ${val?"ml-6":"ml-0.5"}`}/></button>))}</div>))}</div>
      </div>)}

      {tab==="Reviews"&&(<div className="space-y-3">
        <p className="text-sm text-slate-500">Review all submitted reviews before they appear on the public website.</p>
        {reviews.length===0?<div className="card p-10 text-center text-slate-500"><Star className="mx-auto mb-2"/>No reviews yet.</div>:
          <div className="card divide-y divide-slate-100 overflow-hidden">{reviews.map((r:any)=>(
            <div key={r.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{r.reviewer_name} <span className="text-xs text-slate-400">on {r.products?.model}</span></p>
                <p className="flex mt-0.5">{"⭐".repeat(r.rating)}</p>{r.title&&<p className="font-medium mt-1">{r.title}</p>}<p className="text-slate-600 truncate">{r.body}</p></div>
                <div className="flex flex-col gap-1 shrink-0"><Pill tone={r.status==="approved"?"green":r.status==="rejected"?"red":"gold"}>{r.status}</Pill>
                  {r.status==="pending"&&<><button onClick={()=>approveReview(r.id)} className="text-xs text-emerald-600 font-semibold hover:underline">Approve</button><button onClick={()=>rejectReview(r.id)} className="text-xs text-rose-600 font-semibold hover:underline">Reject</button></>}</div>
              </div>
            </div>))}</div>}
      </div>)}

      {tab==="Analytics"&&<div className="card p-10 text-center text-slate-500"><BarChart3 className="mx-auto mb-2"/>Analytics integration (Google Analytics / Plausible) can be added in Settings. Traffic data will appear here.</div>}
    </motion.div></AnimatePresence>

    <Drawer open={addOpen||!!editItem||!!editSec} onClose={closeDrawer}
      title={editSec?"Edit section":editItem?"Edit content":"Add website content"}
      subtitle={editSec?"Heading, image and CTA for this whole block":"Changes appear on the public website instantly"}
      footer={<><button onClick={closeDrawer} className="btn btn-ghost">Cancel</button>
        <button disabled={busy} onClick={editSec?saveSection:saveContent} className="btn btn-gold">
          {busy?"Saving…":editSec?"Save section":editItem?"Save changes":"Add content"}</button></>}>
      {editSec?SectionForm:ContentForm}
    </Drawer>

    <BulkUploadModal open={!!bulkFor} section={bulkFor} startOrder={bulkStart}
      onClose={()=>setBulkFor(null)} onCreated={()=>router.refresh()}/>

    <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} wide
      title="Live preview" subtitle="The real website, rendered as visitors see it right now.">
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" role="switch" aria-checked={pvHidden} onClick={()=>setPvHidden(v=>!v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${pvHidden?"border-amber-300 bg-amber-50 text-amber-800":"border-slate-200 text-slate-600"}`}>
            <span className={`relative h-4 w-8 rounded-full transition ${pvHidden?"bg-amber-500":"bg-slate-300"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${pvHidden?"left-[18px]":"left-0.5"}`}/>
            </span>
            Show hidden content
          </button>
          <span className="text-[11px] text-slate-400">
            {pvHidden
              ? previewKey
                ? "Hidden sections and inactive cards are visible to you only."
                : "SITE_PREVIEW_KEY isn't set, so this is the public view."
              : "Exactly what visitors see."}
          </span>
          <span className="flex-1"/>
          <button type="button" onClick={()=>setPreviewNonce(n=>n+1)} className="btn btn-ghost text-xs">Refresh</button>
          <a href={previewSrc} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs">Open in new tab</a>
        </div>
        {/* Keyed on the source: changing it remounts the frame, which is the only
            way to reload a cross-origin iframe we aren't allowed to script. */}
        <iframe key={previewSrc} src={previewSrc} title="Website preview"
          className="h-[68vh] w-full rounded-xl border border-slate-200 bg-white"/>
      </div>
    </Modal>
  </div>);
}
