"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera, FileText, Pencil, Sparkles, UploadCloud, Check, ChevronRight, ScanLine } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { inr } from "@/lib/types";

const USAGE = [
  { key:"recommend",  label:"Not sure? We'll recommend one", desc:"Enter your Rx and we'll match it.",     ai:true },
  { key:"single",     label:"Single Vision",                 desc:"Corrects for one distance (near or far)." },
  { key:"progressive",label:"Progressives (No Line)",        desc:"Seamless vision across all distances."    },
  { key:"reading",    label:"Readers",                       desc:"Near vision for close-up tasks."         },
  { key:"bifocal",    label:"Bifocal (Visible Line)",        desc:"Near and distance with a visible line."  },
  { key:"non_rx",    label:"Non-prescription",               desc:"Style and protection."                   },
];
const STEPS = ["Usage","Prescription","Lens","Add-Ons"] as const;
type Step = (typeof STEPS)[number];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b border-slate-100">
      {STEPS.map((s,i) => (
        <div key={s} className="flex items-center">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${i < step ? "bg-navy-800 text-white" : i === step ? "bg-gold-500 text-white" : "bg-slate-100 text-slate-400"}`}>
            {i < step ? <Check size={14}/> : i+1}
          </div>
          <span className={`ml-2 text-sm font-medium ${i === step ? "text-navy-900" : "text-slate-400"}`}>{s}</span>
          {i < STEPS.length-1 && <div className={`mx-3 h-px w-10 ${i < step ? "bg-navy-800" : "bg-slate-200"}`}/>}
        </div>))}
    </div>);
}

function RxForm({ values, onChange }: { values: any; onChange: (v: any) => void }) {
  const fields = [["sph","SPH"],["cyl","CYL"],["axis","AXIS"]] as [string,string][];
  return (
    <div className="space-y-3">
      {[["od","Right Eye (OD)","blue"],["os","Left Eye (OS)","orange"]] .map(([side,label,col]) => (
        <div key={side} className={`rounded-2xl border p-4 ${col==="blue"?"border-blue-200 bg-blue-50/40":"border-orange-200 bg-orange-50/40"}`}>
          <p className={`font-semibold mb-3 text-sm ${col==="blue"?"text-blue-700":"text-orange-600"}`}>{label}</p>
          <div className="grid grid-cols-3 gap-2">
            {fields.map(([k,l]) => (
              <label key={k} className="block"><span className="mb-1 block text-xs text-slate-500">{l}</span>
                <input type="number" step={k==="axis"?"1":"0.25"} value={values?.[side]?.[k]??""} onChange={e=>onChange({...values,[side]:{...values?.[side],[k]:e.target.value?Number(e.target.value):null}})} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-center outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/10"/></label>))}
          </div>
        </div>))}
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="mb-1 block text-xs text-slate-500">PD far (mm)</span><input type="number" step="0.5" value={values?.pd_far??""} onChange={e=>onChange({...values,pd_far:e.target.value?Number(e.target.value):null})} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-navy-700"/></label>
        <label className="block"><span className="mb-1 block text-xs text-slate-500">PD near (mm)</span><input type="number" step="0.5" value={values?.pd_near??""} onChange={e=>onChange({...values,pd_near:e.target.value?Number(e.target.value):null})} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-navy-700"/></label>
      </div>
    </div>);
}

export function LensConfigurator({ open, onClose, product }: { open: boolean; onClose: () => void; product?: any }) {
  const [step, setStep] = useState(0);
  const [usage, setUsage] = useState(""); const [rxMethod, setRxMethod] = useState("");
  const [rxValues, setRxValues] = useState<any>({}); const [rxFile, setRxFile] = useState<File|null>(null); const [rxPreview, setRxPreview] = useState("");
  const [scanning, setScanning] = useState(false); const [ocrFlags, setOcrFlags] = useState<string[]>([]);
  const [packages, setPackages] = useState<any[]>([]); const [options, setOptions] = useState<any[]>([]);
  const [selPkg, setSelPkg] = useState(""); const [selIdx, setSelIdx] = useState(""); const [selAddons, setSelAddons] = useState<string[]>([]);
  const [savedRx, setSavedRx] = useState<any[]>([]);

  useEffect(() => { if (!open) { setStep(0); setUsage(""); setRxMethod(""); setRxValues({}); setRxFile(null); setRxPreview(""); setSelPkg(""); setSelIdx(""); setSelAddons([]); } }, [open]);
  useEffect(() => { if (step===2 && packages.length===0) {
    const sb = supabaseBrowser();
    Promise.all([sb.from("lens_packages").select("*").eq("status","active").order("display_order"), sb.from("lens_options").select("*").eq("status","active").order("display_order")])
      .then(([{data:p},{data:o}]) => { setPackages(p??[]); setOptions(o??[]); if(p?.[0]) setSelPkg(p[0].id); const fi = (o??[]).find((x:any)=>x.grp==="index"); if(fi) setSelIdx(fi.id); }); } }, [step]);

  async function onFile(f: File|undefined) {
    if(!f) return; setRxFile(f); setRxPreview(URL.createObjectURL(f)); setScanning(true);
    const fd=new FormData(); fd.append("file",f);
    try { const r=await fetch("/api/ocr",{method:"POST",body:fd}); const j=await r.json(); if(r.ok){setRxValues(j.values); setOcrFlags(j.flags??[]); setStep(1.5 as any);} } catch {}
    setScanning(false);
  }

  const pkg = packages.find(p=>p.id===selPkg);
  const idxOpts = options.filter(o=>o.grp==="index");
  const addonOpts = options.filter(o=>o.grp==="addon");
  const selIdxObj = options.find(o=>o.id===selIdx);
  const selAddonObjs = selAddons.map(id=>options.find(o=>o.id===id)).filter(Boolean);
  const lensTotal = pkg ? Number(pkg.base_price) + Number(selIdxObj?.price??0) + selAddonObjs.reduce((a:number,o:any)=>a+Number(o.price),0) : 0;
  const total = Number(product?.selling_price??0) + lensTotal;

  const cart = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("pe_cart_v3")??"[]"); } catch { return []; } })() : [];
  function addToCart() {
    const item = { id: Math.random().toString(36).slice(2), productId: product?.id, productName: `${product?.brand??""} ${product?.model??""}`.trim(), brand: product?.brand, image: product?.images?.[0], framePrice: Number(product?.selling_price??0), lensTotal, total, qty: 1, power_eligible: true, lensPackageId: pkg?.id, lensPackageName: pkg?.name, addons: selAddonObjs.map((o:any)=>o.name), rx: rxValues };
    const updated = [...cart, item];
    try { localStorage.setItem("pe_cart_v3", JSON.stringify(updated)); } catch {}
    window.dispatchEvent(new Event("pe_cart_update"));
    onClose();
    window.location.href = "/cart";
  }

  const stepContent: Record<number, React.ReactNode> = {
    0: (<div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">How will you use your glasses?</p>
      <p className="text-xs text-slate-500">Help us recommend the best lenses for your lifestyle.</p>
      <div className="space-y-2">{USAGE.map(u=>(
        <button key={u.key} onClick={()=>setUsage(u.key)} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${usage===u.key?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-300"}`}>
          {u.ai&&<Sparkles size={16} className="mt-0.5 shrink-0 text-gold-500"/>}
          <div><p className="text-sm font-semibold">{u.label}</p><p className="text-xs text-slate-500">{u.desc}</p></div>
          {usage===u.key&&<Check size={16} className="ml-auto mt-0.5 shrink-0 text-gold-500"/>}
        </button>))}</div>
    </div>),

    1: (<div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">Choose how to add your prescription</p>
      {[{key:"upload",icon:Camera,l:"Upload a photo",d:"Upload a clear photo of your prescription."},{key:"saved",icon:FileText,l:"Use a saved prescription",d:"Select a saved prescription from your account."},{key:"manual",icon:Pencil,l:"Fill it out myself",d:"Enter your prescription details manually."}].map(m=>(
        <button key={m.key} onClick={()=>setRxMethod(m.key)} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${rxMethod===m.key?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-300"}`}>
          <m.icon size={20} className={rxMethod===m.key?"text-gold-500":"text-slate-500"}/><div><p className="font-semibold text-sm">{m.l}</p><p className="text-xs text-slate-500">{m.d}</p></div>
          {rxMethod===m.key&&<Check size={16} className="ml-auto shrink-0 text-gold-500"/>}
        </button>))}
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Have prism values? The scan can't capture prism values. Please enter manually from your prescription if noted.</p>
      {rxMethod==="upload"&&(<div className="space-y-3">
        <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files[0]);}} className="relative grid min-h-44 place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center cursor-pointer" onClick={()=>document.getElementById("rx-file")?.click()}>
          {rxPreview?<img src={rxPreview} alt="Rx" className="max-h-40 rounded-xl object-contain"/>:<div><UploadCloud size={32} className="mx-auto mb-2 text-slate-400"/><p className="text-sm font-medium">Drag or click to upload</p><p className="text-xs text-slate-400 mt-1">JPG, PNG or PDF · Max 20 MB</p></div>}
          {scanning&&<div className="absolute inset-0 flex items-end justify-center bg-black/10 rounded-2xl pb-3"><div className="rounded-full bg-navy-900/90 px-3 py-1 text-xs text-white">Reading values…</div></div>}
        </div>
        <input id="rx-file" type="file" accept="image/*,.pdf" hidden onChange={e=>onFile(e.target.files?.[0])}/>
        <button onClick={()=>document.getElementById("rx-file-cam")?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3 text-sm font-medium hover:border-navy-700 transition"><Camera size={16}/>Take a photo</button>
        <input id="rx-file-cam" type="file" accept="image/*" capture="environment" hidden onChange={e=>onFile(e.target.files?.[0])}/>
        <div className="rounded-xl bg-navy-50 p-3 text-xs text-slate-600 space-y-1"><p className="font-semibold">Tips for a clear photo:</p>{["Make sure the full prescription is visible","Good lighting, no blur","Include both eyes (OD/OS)"].map(t=><p key={t}>✓ {t}</p>)}</div>
      </div>)}
      {rxMethod==="manual"&&<RxForm values={rxValues} onChange={setRxValues}/>}
    </div>),

    2: (<div className="space-y-4">
      <p className="text-sm font-semibold">What type of lens do you need?</p>
      <p className="text-xs text-slate-500">We've selected the best options for your prescription.</p>
      <div className="flex gap-2 mb-3">{["Recommended","All Lenses","Compare"].map(t=><button key={t} className={`rounded-full border px-4 py-1.5 text-xs font-medium ${t==="Recommended"?"bg-navy-900 text-white border-navy-900":"border-slate-200 text-slate-600 hover:border-navy-700"}`}>{t}</button>)}</div>
      {packages.length===0&&<p className="text-slate-400 text-sm text-center py-8">Loading packages…</p>}
      <div className="space-y-2">{packages.map(p=>(
        <button key={p.id} onClick={()=>setSelPkg(p.id)} className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${selPkg===p.id?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-200"}`}>
          <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-blue-200 to-blue-400 flex items-center justify-center text-lg">🔭</div>
          <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-slate-500 capitalize">{p.design?.replace("_"," ")}{p.short_desc?` | ${p.short_desc}`:""}</p>
            <div className="flex flex-wrap gap-1 mt-1">{(p.features||[]).slice(0,3).map((f:string)=><span key={f} className="text-[10px] bg-navy-50 text-navy-700 px-2 py-0.5 rounded-full">✓ {f}</span>)}</div></div>
          <span className="text-sm font-bold text-gold-600 shrink-0">+{inr(p.base_price)}</span>
        </button>))}
      </div>
      {idxOpts.length>0&&<><p className="text-sm font-semibold mt-4">Select a lens index</p>
        <div className="space-y-2">{idxOpts.map(o=>(
          <button key={o.id} onClick={()=>setSelIdx(o.id)} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${selIdx===o.id?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-200"}`}>
            <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-blue-100"/>
            <div className="flex-1"><p className="text-sm font-semibold">{o.name}</p><p className="text-xs text-slate-500">{o.description}</p></div>
            <span className="text-sm font-semibold text-navy-800">{Number(o.price)>0?`+${inr(o.price)}`:"Included"}</span>
          </button>))}</div></>}
    </div>),

    3: (<div className="space-y-3">
      <p className="text-sm font-semibold">Add-Ons <span className="font-normal text-slate-500">(optional)</span></p>
      <p className="text-xs text-slate-500">Customise your lenses for extra comfort and protection.</p>
      <div className="space-y-2">{addonOpts.map(o=>{const on=selAddons.includes(o.id); return (
        <button key={o.id} onClick={()=>setSelAddons(on?selAddons.filter(x=>x!==o.id):[...selAddons,o.id])} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${on?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-200"}`}>
          <div className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition ${on?"border-gold-500 bg-gold-500":""}`}>{on&&<Check size={12} className="text-white"/>}</div>
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-blue-100"/>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{o.name} {o.badge&&<span className="ml-1 rounded bg-amber-200 px-1.5 text-[10px] font-bold text-amber-900">{o.badge}</span>}</p><p className="text-xs text-slate-500 truncate">{o.description}</p></div>
          <span className="text-sm font-semibold text-navy-800 shrink-0">+{inr(o.price)}</span>
        </button>);})}</div>
    </div>),
  };

  return (
    <AnimatePresence>
      {open&&(
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/>
          <div className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div className="relative flex h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-3xl shadow-2xl"
              initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}} transition={{type:"spring",damping:28,stiffness:320}}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">👓</div>
                  <div><p className="font-bold text-sm text-navy-900">{product?.brand} {product?.model}</p>
                    <p className="text-xs text-slate-500">{product?.attrs?.color} · {product?.attrs?.size} · {product?.sku}</p></div>
                </div>
                <button onClick={onClose} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16}/></button>
              </div>
              <ProgressBar step={step}/>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:.18}}>
                    {stepContent[step]}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 p-4">
                {step>0&&step<3&&(
                  <div className="mb-3 rounded-xl bg-white border border-slate-100 p-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Frame</span><span className="font-semibold">{inr(product?.selling_price)}</span></div>
                    {lensTotal>0&&<div className="flex justify-between"><span className="text-slate-500">Lenses</span><span className="font-semibold">+{inr(lensTotal)}</span></div>}
                    <div className="flex justify-between font-bold mt-1 pt-1 border-t border-slate-100"><span>Total</span><span>{inr(total)}</span></div>
                  </div>)}
                <div className="flex gap-3">
                  {step>0&&<button onClick={()=>setStep(s=>s-1)} className="btn-ghost flex-1 rounded-full border border-slate-200 py-3 text-sm font-medium">← Back</button>}
                  {step<3
                    ? <button onClick={()=>setStep(s=>s+1)} disabled={step===0&&!usage} className="flex-1 rounded-full bg-navy-900 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-navy-800 transition">Continue →</button>
                    : <button onClick={addToCart} className="flex-1 rounded-full bg-gold-500 py-3 text-sm font-semibold text-white hover:bg-gold-600 transition">Add to Cart → {inr(total)}</button>}
                </div>
              </div>
            </motion.div>
          </div>
        </div>)}
    </AnimatePresence>);
}
