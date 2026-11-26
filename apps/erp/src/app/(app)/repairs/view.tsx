"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { CameraOff, CheckCircle2, Flame, ImagePlus, Plus, Printer, Search, Trash2, Wrench, X } from "lucide-react";
import { dbError, inr } from "@poweros/business-rules";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { supabaseBrowser } from "@/lib/supabase/client";
import { shrink } from "@/lib/image";
import { advanceRepair, saveRepair } from "./actions";

const STATUS_FLOW: Record<string,{next:string;label:string}[]> = {
  pending:[{next:"in_progress",label:"Start repair"},{next:"cancelled",label:"Cancel"}],
  in_progress:[{next:"ready",label:"Mark ready"},{next:"cancelled",label:"Cancel"}],
  ready:[{next:"delivered",label:"Mark delivered"}],
};
const TONE: any={ pending:"gold",in_progress:"blue",ready:"green",delivered:"green",cancelled:"red" };
const TYPES=["Spectacle Frame","Sunglasses","Contact Lens Pack","Accessory","Other"];
const L=({t,children}:{t:string;children:React.ReactNode})=><label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;

// Signed-URL thumbnails for repair photos (bucket is private).
function Shots({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join(",");
  useEffect(() => {
    let alive = true; if (!paths.length) { setUrls({}); return; }
    const sb = supabaseBrowser();
    Promise.all(paths.map((p) => sb.storage.from("repair-images").createSignedUrl(p, 3600)
      .then(({ data }) => [p, data?.signedUrl ?? ""] as const)))
      .then((pairs) => { if (alive) setUrls(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [key]);
  if (!paths.length) return null;
  return (<div className="grid grid-cols-3 gap-2">{paths.map((p) => urls[p]
    ? <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50"><img src={urls[p]} alt="" className="h-full w-full object-cover" /></a>
    : <div key={p} className="aspect-square animate-pulse rounded-xl bg-slate-100" />)}</div>);
}

// Buffered intake photos: shrunk client-side, uploaded at save time (so the
// customer folder path is known), max 3 including any already stored.
function PhotoZone({ existing, shots, onAdd, onRemove, onRemoveExisting }: {
  existing: string[]; shots: { url: string }[];
  onAdd: (files: FileList | null) => void; onRemove: (i: number) => void; onRemoveExisting: (p: string) => void;
}) {
  const total = existing.length + shots.length;
  return (<div className="space-y-2">
    <div className="grid grid-cols-3 gap-2">
      {existing.map((p) => <div key={p} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        <Shots paths={[p]} />
        <button type="button" title="Remove" onClick={() => onRemoveExisting(p)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow opacity-0 transition group-hover:opacity-100 max-sm:opacity-100"><X size={13} /></button>
      </div>)}
      {shots.map((s, i) => <div key={s.url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        <img src={s.url} alt="" className="h-full w-full object-cover" />
        <button type="button" title="Remove" onClick={() => onRemove(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow opacity-0 transition group-hover:opacity-100 max-sm:opacity-100"><X size={13} /></button>
      </div>)}
      {total < 3 && <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 transition hover:bg-slate-50">
        <span><ImagePlus size={20} className="mx-auto mb-1" />Add photo ({3 - total} left)</span>
        <input hidden type="file" accept="image/*" multiple onChange={(e) => onAdd(e.target.files)} /></label>}
    </div>
    <p className="text-xs text-slate-500">Up to 3 photos of the item as received (JPG/PNG, compressed automatically).</p>
  </div>);
}

function RepairForm({ open,onClose,repair,customers,branches,initialCustomer }:any) {
  const router=useRouter(); const toast=useToast(); const [busy,setBusy]=useState(false);
  const [cq,setCq]=useState(""); const [custId,setCustId]=useState("");
  const [f,setF]=useState<any>({});
  const [shots,setShots]=useState<{blob:Blob;url:string}[]>([]);
  useEffect(()=>{
    if(!open) return;
    if(repair){ setCustId(repair.customer_id??""); setF({...repair, repair_charges:String(repair.repair_charges??0), parts_cost:String(repair.parts_cost??0), discount:String(repair.discount??0), tax_pct:String(repair.tax_pct??0), photo_consent:!!repair.photo_consent }); }
    else { setCustId(initialCustomer??""); setCq(""); setF({ item_type:"Spectacle Frame", priority:"medium", repair_charges:"0", parts_cost:"0", discount:"0", tax_pct:"0", photo_consent:false }); }
    setShots([]);
  },[open,repair?.id,initialCustomer]);
  const matchC=customers.filter((c:any)=>`${c.full_name} ${c.phone} ${c.vision_id}`.toLowerCase().includes(cq.toLowerCase())).slice(0,5);
  const selC=customers.find((c:any)=>c.id===custId);
  const existing:string[]=f.images??[];
  async function addPhotos(files:FileList|null){
    if(!files) return;
    const room=3-existing.length-shots.length; if(room<=0) return;
    const added:{blob:Blob;url:string}[]=[];
    for(const file of Array.from(files).slice(0,room)){
      try{ const blob=await shrink(file,1400); added.push({blob,url:URL.createObjectURL(blob)}); }
      catch{ toast("Could not read that image","err"); }
    }
    setShots((x)=>[...x,...added]);
  }
  async function save(){
    setBusy(true);
    // Upload buffered intake photos into the customer's folder (max 3 total).
    const paths=[...existing];
    if(shots.length){
      const sb=supabaseBrowser();
      const { data: { user: u } } = await sb.auth.getUser(); const {data:p}=await sb.from("profiles").select("org_id").eq("id", u?.id ?? "").single();
      const folder=p?.org_id&&custId?`${p.org_id}/${custId}`:p?.org_id?`${p.org_id}/_no_customer`:"";
      for(const s of shots){
        const path=`${folder}/${crypto.randomUUID()}.jpg`;
        const {error}=await sb.storage.from("repair-images").upload(path,s.blob,{contentType:"image/jpeg"});
        if(error){ setBusy(false); return toast(dbError(error.message),"err"); }
        paths.push(path);
      }
    }
    const noPhotos=paths.length===0;
    const r=await saveRepair({ id:repair?.id, customer_id:custId, referred_by:f.referred_by, item_brand:f.item_brand, item_model:f.item_model, item_type:f.item_type, item_color:f.item_color, frame_no:f.frame_no, problem:f.problem, technician_notes:f.technician_notes, priority:f.priority, assigned_to:f.assigned_to, due_date:f.due_date, repair_charges:Number(f.repair_charges||0), parts_cost:Number(f.parts_cost||0), discount:Number(f.discount||0), tax_pct:Number(f.tax_pct||0),
      images:paths, photo_consent:noPhotos?!!f.photo_consent:false, photo_consent_at:repair?.photo_consent_at??undefined });
    setBusy(false); if(r.error) return toast(r.error,"err"); toast(`Repair ${r.ok} saved`); router.refresh(); onClose();
  }
  return(
    <Drawer open={open} onClose={onClose} title={repair?"Edit repair":"New repair"} subtitle="Assign a customer and describe the problem"
      footer={<><button onClick={onClose} className="btn btn-ghost">Cancel</button><button disabled={busy} onClick={save} className="btn btn-gold">{busy?"Saving…":"Save repair"}</button></>}>
      <div className="space-y-3">
        {selC?<div className="flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3"><div><p className="font-semibold">{selC.full_name}</p><p className="text-xs text-slate-500">{selC.vision_id} | {selC.phone}</p></div><button onClick={()=>{setCustId("");setCq("");}} className="text-xs text-navy-700 underline">Change</button></div>:
          <div><div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-slate-400"/><input value={cq} onChange={e=>setCq(e.target.value)} placeholder="Find customer by name, phone or Vision ID" className="field pl-9"/></div>
            <div className="mt-1 space-y-1">{matchC.map((c:any)=><button key={c.id} onClick={()=>{setCustId(c.id);setCq("");}} className="flex w-full justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-navy-50"><b>{c.full_name}</b><span className="text-slate-500">{c.phone}</span></button>)}</div></div>}
        <L t="Referred by"><input className="field" value={f.referred_by??""} onChange={e=>setF({...f,referred_by:e.target.value})} placeholder="Dr. name (optional)"/></L>
        <p className="pt-1 text-sm font-semibold text-navy-700">Item details</p>
        <div className="grid gap-3 sm:grid-cols-2"><L t="Brand"><input className="field" value={f.item_brand??""} onChange={e=>setF({...f,item_brand:e.target.value})}/></L><L t="Model / Serial no."><input className="field" value={f.item_model??""} onChange={e=>setF({...f,item_model:e.target.value})}/></L></div>
        <div className="grid gap-3 sm:grid-cols-3"><L t="Type"><select className="field" value={f.item_type??""} onChange={e=>setF({...f,item_type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></L><L t="Colour"><input className="field" value={f.item_color??""} onChange={e=>setF({...f,item_color:e.target.value})}/></L><L t="Frame no."><input className="field" value={f.frame_no??""} onChange={e=>setF({...f,frame_no:e.target.value})}/></L></div>
        <L t="Problem reported *"><textarea className="field" rows={2} value={f.problem??""} onChange={e=>setF({...f,problem:e.target.value})} placeholder="Describe what the customer reported…"/></L>
        <p className="pt-1 text-sm font-semibold text-navy-700">Photos</p>
        <PhotoZone existing={existing} shots={shots} onAdd={addPhotos}
          onRemove={(i)=>setShots((x)=>{URL.revokeObjectURL(x[i].url);return x.filter((_,j)=>j!==i);})}
          onRemoveExisting={(p)=>setF({...f,images:existing.filter((x)=>x!==p)})}/>
        {existing.length+shots.length===0&&(
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-100 p-3">
            <input type="checkbox" checked={!!f.photo_consent} onChange={e=>setF({...f,photo_consent:e.target.checked})} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy-700"/>
            <span className="text-xs leading-relaxed text-slate-600">Customer has no photos for this item — <b>consent recorded</b> to proceed without photos.<span className="text-slate-400"> (Saved with a timestamp.)</span></span>
          </label>)}
        <L t="Technician notes"><textarea className="field" rows={2} value={f.technician_notes??""} onChange={e=>setF({...f,technician_notes:e.target.value})}/></L>
        <div className="grid gap-3 sm:grid-cols-3"><L t="Priority"><select className="field" value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{["low","medium","high","urgent"].map(p=><option key={p} className="capitalize">{p}</option>)}</select></L><L t="Assigned to"><input className="field" value={f.assigned_to??""} onChange={e=>setF({...f,assigned_to:e.target.value})}/></L><L t="Due date"><input type="date" className="field" value={f.due_date??""} onChange={e=>setF({...f,due_date:e.target.value})}/></L></div>
        <p className="pt-1 text-sm font-semibold text-navy-700">Cost</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><L t="Repair charges"><input className="field" inputMode="decimal" value={f.repair_charges} onChange={e=>setF({...f,repair_charges:e.target.value})}/></L><L t="Parts cost"><input className="field" inputMode="decimal" value={f.parts_cost} onChange={e=>setF({...f,parts_cost:e.target.value})}/></L><L t="Discount"><input className="field" inputMode="decimal" value={f.discount} onChange={e=>setF({...f,discount:e.target.value})}/></L><L t="GST %"><input className="field" inputMode="decimal" value={f.tax_pct} onChange={e=>setF({...f,tax_pct:e.target.value})}/></L></div>
        {(Number(f.repair_charges)||Number(f.parts_cost))>0&&<p className="rounded-xl bg-navy-50 p-3 text-sm font-medium">Total: {inr(Math.round(((Number(f.repair_charges||0)+Number(f.parts_cost||0)-Number(f.discount||0))*(1+Number(f.tax_pct||0)/100))*100)/100)}</p>}
      </div>
    </Drawer>);
}

function Detail({ r,onClose }:{r:any|null;onClose:()=>void}) {
  const router=useRouter(); const toast=useToast(); const [note,setNote]=useState(""); const [busy,setBusy]=useState(false); const [events,setEvents]=useState<any[]>([]);
  const [editing,setEditing]=useState(false); const [afterBusy,setAfterBusy]=useState(false);
  useEffect(()=>{ if(!r) return; setNote(""); import("@/lib/supabase/client").then(({supabaseBrowser})=>supabaseBrowser().from("repair_events").select("*").eq("repair_id",r.id).order("at").then(({data})=>setEvents(data??[]))); },[r?.id,r?.status]);
  async function addAfter(files:FileList|null){
    if(!files||afterBusy) return;
    const cur:string[]=r.after_images??[]; const room=3-cur.length; if(room<=0) return toast("Up to 3 after photos","err");
    setAfterBusy(true);
    const sb=supabaseBrowser();
    const { data: { user: u } } = await sb.auth.getUser(); const {data:p}=await sb.from("profiles").select("org_id").eq("id", u?.id ?? "").single();
    const folder=p?.org_id&&r.customer_id?`${p.org_id}/${r.customer_id}`:p?.org_id?`${p.org_id}/_no_customer`:"";
    const added:string[]=[];
    for(const file of Array.from(files).slice(0,room)){
      try{ const path=`${folder}/${crypto.randomUUID()}.jpg`;
        const {error}=await sb.storage.from("repair-images").upload(path,await shrink(file,1400),{contentType:"image/jpeg"});
        if(error){ toast(dbError(error.message),"err"); break; } added.push(path); }
      catch{ toast("Could not read that image","err"); break; }
    }
    if(added.length){
      const {error}=await sb.from("repairs").update({after_images:[...cur,...added]}).eq("id",r.id);
      if(error) toast(dbError(error.message),"err"); else { toast("After photo added"); router.refresh(); }
    }
    setAfterBusy(false);
  }
  if(!r) return <Modal open={false} onClose={onClose} title="" children={null}/>;
  const c=r.customers; const phone=(c?.whatsapp||c?.phone||"");
  // Pickup message now comes from the message_templates settings.
  async function go(to:string){ setBusy(true); const res=await advanceRepair(r.id,to,note||undefined); setBusy(false); if(res.error) return toast(res.error,"err"); toast(res.ok!); router.refresh(); }
  const TONE_C:any={low:"text-slate-500",medium:"text-blue-600",high:"text-amber-700",urgent:"text-rose-600"};
  return(<>
    <Modal open onClose={onClose} wide title={`Repair ${r.code}`} subtitle={`${c?.full_name} | ${c?.vision_id} | ${new Date(r.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}`}>
      <div className="p-6 space-y-4">
        {/* Status stepper */}
        <div className="flex items-center gap-0 overflow-x-auto rounded-2xl bg-slate-50 p-3">
          {["pending","in_progress","ready","delivered"].map((s,i)=>{const done=["pending","in_progress","ready","delivered"].indexOf(r.status)>=i; return(<><span key={s} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium ${done?"bg-navy-800 text-white":"bg-white text-slate-500 border"}`}>{s.replace("_"," ")}</span>{i<3&&<span className="mx-1 text-slate-300">→</span>}</> );})}
          {r.status==="cancelled"&&<Pill tone="red">Cancelled</Pill>}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <div className="card p-4 text-sm space-y-1"><p><span className="text-slate-500">Customer:</span> <b>{c?.full_name}</b> | {c?.phone}</p><p><span className="text-slate-500">Referred by:</span> {r.referred_by||"—"}</p></div>
            <div className="card p-4 text-sm space-y-1"><p className="font-semibold mb-1">Item</p><p>{[r.item_brand,r.item_model,r.item_color,r.item_type].filter(Boolean).join(" · ")}</p>{r.frame_no&&<p className="text-slate-500">Frame no: {r.frame_no}</p>}</div>
            <div className="card p-4 text-sm"><p className="font-semibold mb-1 text-rose-700">Problem reported</p><p>{r.problem}</p>{r.technician_notes&&<><p className="font-semibold mt-2">Technician notes</p><p>{r.technician_notes}</p></>}</div>
            {/* Photos: intake + after-repair, with consent record */}
            <div className="card p-4 text-sm space-y-3">
              <div className="flex items-center justify-between"><p className="font-semibold">Photos</p>
                <label className={`cursor-pointer text-xs font-medium text-navy-700 ${(r.after_images?.length??0)>=3?"pointer-events-none opacity-40":""}`}>
                  {afterBusy?"Uploading…":"Add after photo"}
                  {!afterBusy&&<input hidden type="file" accept="image/*" multiple onChange={e=>addAfter(e.target.files)}/>}
                </label></div>
              {(r.images?.length??0)>0&&<div><p className="mb-1.5 text-xs text-slate-500">As received ({r.images.length})</p><Shots paths={r.images}/></div>}
              {(r.after_images?.length??0)>0&&<div><p className="mb-1.5 text-xs text-slate-500">After repair ({r.after_images.length})</p><Shots paths={r.after_images}/></div>}
              {r.photo_consent&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <b>Consent recorded</b> — customer proceeded without photos{r.photo_consent_at?` on ${new Date(r.photo_consent_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}`:""}.</p>}
              {(r.images?.length??0)===0&&(r.after_images?.length??0)===0&&!r.photo_consent&&<p className="flex items-center gap-2 text-xs text-slate-400"><CameraOff size={14}/>No photos and no consent on record yet.</p>}
            </div>
            <div className="card p-4 text-sm space-y-1"><p className="font-semibold mb-1">Cost summary</p>{[["Repair charges",inr(r.repair_charges)],["Parts cost",inr(r.parts_cost)],["Discount",`-${inr(r.discount)}`],[`GST (${r.tax_pct}%)`,inr(Math.round((r.repair_charges+r.parts_cost-r.discount)*r.tax_pct/100*100)/100)],["Total",inr(r.total_amount)]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold">{v}</span></div>)}</div>
            {/* Timeline */}
            <div className="card p-4"><p className="font-semibold mb-2 text-sm">Timeline</p>
              <ol className="border-l-2 border-slate-100 pl-3 space-y-2 text-xs">{events.map((e:any)=><li key={e.id}><b className="capitalize">{e.to_status.replace("_"," ")}</b> <span className="text-slate-500">{new Date(e.at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span>{e.note&&<span className="block text-slate-600">{e.note}</span>}</li>)}<li><b>Received</b> <span className="text-slate-500">{new Date(r.created_at).toLocaleDateString("en-IN")}</span></li></ol></div>
          </div>
          <div className="space-y-3">
            <div className="card p-4 text-sm space-y-1"><p><b>Priority:</b> <span className={TONE_C[r.priority]}>{r.priority}</span></p><p><b>Assigned:</b> {r.assigned_to||"—"}</p><p><b>Due:</b> {r.due_date?new Date(r.due_date).toLocaleDateString("en-IN"):"—"}</p><p><b>Status:</b> <Pill tone={TONE[r.status]}>{r.status.replace("_"," ")}</Pill></p></div>
            <a href={`/print/repair/${r.id}`} target="_blank" className="btn btn-ghost w-full"><Printer size={16}/>Print repair card (A5)</a>
            {["pending","in_progress","ready"].includes(r.status)&&<WhatsAppSend phone={phone} doc={{ type: "repair", id: r.id }}
              keys={["repair_received", "repair_in_progress", "repair_ready"]}
              vars={{ Name: c?.full_name ?? "", Item: [r.item_brand, r.item_model].filter(Boolean).join(" ") || "your eyewear" }}
              defaultKey={r.status === "pending" ? "repair_received" : r.status === "in_progress" ? "repair_in_progress" : "repair_ready"}
              label={r.status === "ready" ? "WhatsApp pickup alert" : "Send update"} />}
            {STATUS_FLOW[r.status]?.map(({next,label})=><div key={next} className="space-y-2">
              {next==="ready"&&<><textarea className="field text-sm" rows={2} placeholder="Technician notes (optional)" value={note} onChange={e=>setNote(e.target.value)}/></>}
              <button disabled={busy} onClick={()=>go(next)} className={`btn w-full ${next==="cancelled"?"btn-ghost text-rose-600":"btn-primary"}`}>{label}</button></div>)}
            <button onClick={()=>setEditing(true)} className="btn btn-ghost w-full">Edit details</button>
          </div>
        </div>
      </div>
    </Modal>
    <RepairForm open={editing} onClose={()=>{setEditing(false);router.refresh();}} repair={r} customers={[]} branches={[]}/>
  </>);
}

export function RepairsView({ repairs,customers,branches,openNew,initialCustomer }:any) {
  const [q,setQ]=useState(""); const [sf,setSf]=useState(""); const [addOpen,setAddOpen]=useState(!!openNew); const [sel,setSel]=useState<any>(null);
  const rows=repairs.filter((r:any)=>(!sf||r.status===sf)&&`${r.code} ${r.customers?.full_name} ${r.customers?.phone} ${r.item_brand??""} ${r.item_model??""}`.toLowerCase().includes(q.toLowerCase()));
  const counts:any=repairs.reduce((a:any,r:any)=>{a[r.status]=(a[r.status]??0)+1;return a;},{});
  return(<div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="font-display text-3xl font-semibold">Repairs</h1><p className="text-slate-500">{repairs.length} total{counts.pending?` | ${counts.pending} pending`:""}{ counts.in_progress?` | ${counts.in_progress} in progress`:""}{counts.ready?` | ${counts.ready} ready`:""}</p></div>
      <button onClick={()=>setAddOpen(true)} className="btn btn-primary"><Plus size={16}/>New repair</button></div>
    <div className="flex flex-wrap gap-2">
      {[["","All"],["pending","Pending"],["in_progress","In Progress"],["ready","Ready"],["delivered","Delivered"],["cancelled","Cancelled"]].map(([v,l])=><button key={v} onClick={()=>setSf(v)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${sf===v?"border-navy-800 bg-navy-800 text-white":"border-slate-200 bg-white"}`}>{l}{v&&counts[v]?` (${counts[v]})`:""}</button>)}</div>
    <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} className="field pl-9" placeholder="Search by repair ID, customer, brand…"/></div>
    {rows.length===0?<div className="card p-10 text-center text-slate-500"><Wrench className="mx-auto mb-2"/>No repairs found. Add the first repair request.</div>:
      <div className="card divide-y divide-slate-100 overflow-hidden">{rows.map((r:any)=>(
        <button key={r.id} onClick={()=>setSel(r)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-navy-50 transition">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><b>{r.code}</b>{r.priority==="urgent"&&<Flame size={13} className="text-rose-500"/>}{r.priority==="high"&&<Flame size={13} className="text-amber-500"/>}</span>
            <span className="block text-sm text-slate-600">{r.customers?.full_name} | {[r.item_brand,r.item_model,r.item_type].filter(Boolean).join(" ")}</span>
            <span className="block text-xs text-slate-500 truncate">{r.problem}</span>
          </span>
          <span className="hidden text-sm font-semibold sm:block">{r.total_amount>0?inr(r.total_amount):""}</span>
          {r.due_date&&new Date(r.due_date)<new Date()&&r.status!=="delivered"&&<span className="text-xs font-medium text-rose-600">Overdue</span>}
          <Pill tone={TONE[r.status]}>{r.status.replace("_"," ")}</Pill>
        </button>))}</div>}
    <RepairForm open={addOpen} onClose={()=>setAddOpen(false)} repair={null} customers={customers} branches={branches} initialCustomer={initialCustomer}/>
    <Detail r={sel} onClose={()=>setSel(null)}/>
  </div>);
}
