
"use client";
import { useActionState, useState } from "react";
import { Eye, ChevronRight, ChevronLeft, Check, AlertCircle, Printer } from "lucide-react";
import { saveExamination } from "./examination-actions";

type Props = { customerId: string; appointmentId?: string; existingExam?: any; onClose: () => void };

const VA_DIST_OPTIONS = ["6/60","6/36","6/24","6/18","6/12","6/9","6/6","6/5","CF","HM","PL","NPL"];
const VA_NEAR_OPTIONS = ["N36","N24","N18","N12","N9","N8","N6","N5"];
const COVER_TEST_OPTS = ["orthophoria","esophoria","exophoria","right esotropia","left esotropia","right exotropia","left exotropia"];
const RX_TYPES       = ["single_vision","progressive","bifocal","reading","nil"];
const INDEX_OPTS     = [1.56,1.59,1.60,1.67,1.74];
const MONTHS_OPTS    = [6,12,18,24,36];

function EyeInput({ name, value, onChange, type="text", opts, step, min }: any) {
  if (opts) return (
    <select name={name} value={value??""} onChange={e=>onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-500 bg-white">
      <option value="">—</option>
      {opts.map((o:any)=><option key={o} value={o}>{o}</option>)}
    </select>);
  return <input type={type} name={name} value={value??""} onChange={e=>onChange(e.target.value)}
    step={step} min={min} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-500"/>;
}

function SectionHeader({ step, total, title, icon }: any) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-navy-800 text-white text-sm font-bold shrink-0">{step}</div>
      <div className="flex-1"><p className="font-bold text-slate-800">{title}</p><p className="text-xs text-slate-400">Step {step} of {total}</p></div>
    </div>);
}

export function ExaminationForm({ customerId, appointmentId, existingExam, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);

  // Form state - all fields
  const [f, setF] = useState<Record<string,any>>({
    va_od_dist_ua:"", va_os_dist_ua:"", va_od_near_ua:"", va_os_near_ua:"",
    va_od_dist_a:"",  va_os_dist_a:"",  va_od_near_a:"",  va_os_near_a:"",
    ar_od_sph:"", ar_od_cyl:"", ar_od_axis:"", ar_os_sph:"", ar_os_cyl:"", ar_os_axis:"",
    od_sph:"",  od_cyl:"",  od_axis:"",  od_add:"",  od_va:"6/6",
    os_sph:"",  os_cyl:"",  os_axis:"",  os_add:"",  os_va:"6/6",
    pd_far:"62", pd_near:"",
    cover_test:"orthophoria", iop_od:"", iop_os:"", colour_vision:"normal",
    confrontation:"full", anterior_od:"clear", anterior_os:"clear",
    fundus_od:"", fundus_os:"", disc_od:"", disc_os:"", cup_disc_od:"0.3", cup_disc_os:"0.3",
    macula_od:"flat & even reflex", macula_os:"flat & even reflex",
    vessels_od:"normal calibre & course", vessels_os:"normal calibre & course",
    rx_type:"single_vision", recommended_index:"", lens_recommendation:"", notes:"", next_review_months:"24",
    ...(existingExam ?? {}),
  });

  const set  = (k:string) => (v:any) => setF(prev => ({...prev,[k]:v}));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setErr("");
    const fd = new FormData(e.currentTarget);
    fd.set("customer_id",   customerId);
    fd.set("appointment_id", appointmentId ?? "");
    // Inject all state values into FormData
    Object.entries(f).forEach(([k,v]) => { if (!fd.has(k)) fd.set(k, String(v??"")); });
    const result = await saveExamination(fd);
    setSaving(false);
    if ((result as any)?.error) setErr((result as any).error);
    else setSaved(true);
  }

  if (saved) return (
    <div className="p-8 text-center space-y-4">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50"><Check size={32} className="text-emerald-500"/></div>
      <h3 className="font-bold text-xl text-slate-800">Examination Recorded</h3>
      <p className="text-slate-500 text-sm">{f.od_sph !== "" || f.os_sph !== "" ? "The examination and prescription have been saved." : "The examination has been saved without creating a prescription."}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onClose} className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold hover:bg-slate-50">Done</button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"><Printer size={15}/>Print Report</button>
      </div>
    </div>);

  const STEPS = ["Visual Acuity","Refraction","Clinical Findings","Fundus","Prescription"];

  const RowTable = ({ label, left, right }: { label:string; left:React.ReactNode; right:React.ReactNode }) => (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-2 items-center">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {left}{right}
    </div>);

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Step progress */}
      <div className="flex gap-0 px-5 pt-4 pb-3 border-b border-slate-100 shrink-0 overflow-x-auto">
        {STEPS.map((s,i) => (
          <div key={s} className="flex items-center shrink-0">
            <button type="button" onClick={() => setStep(i)} className={`flex items-center gap-1.5 text-xs font-medium transition ${step===i?"text-navy-900":"text-slate-400 hover:text-slate-600"}`}>
              <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${i<step?"bg-emerald-500 text-white":step===i?"bg-navy-800 text-white":"bg-slate-200 text-slate-500"}`}>{i<step?<Check size={12}/>:i+1}</div>
              <span className="hidden sm:block">{s}</span>
            </button>
            {i<STEPS.length-1 && <div className={`mx-2 h-px w-6 ${i<step?"bg-emerald-500":"bg-slate-200"}`}/>}
          </div>))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Step 0: Visual Acuity */}
        {step===0 && (
          <div className="space-y-5">
            <SectionHeader step={1} total={5} title="Visual Acuity" icon={Eye}/>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
              <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs font-bold text-center text-slate-500">
                <span/>
                <span className="text-blue-600">Right Eye (OD)</span>
                <span className="text-orange-600">Left Eye (OS)</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-1">Unaided (Without Glasses)</p>
              <RowTable label="Distance" left={<EyeInput name="va_od_dist_ua" value={f.va_od_dist_ua} onChange={set("va_od_dist_ua")} opts={VA_DIST_OPTIONS}/>} right={<EyeInput name="va_os_dist_ua" value={f.va_os_dist_ua} onChange={set("va_os_dist_ua")} opts={VA_DIST_OPTIONS}/>}/>
              <RowTable label="Near" left={<EyeInput name="va_od_near_ua" value={f.va_od_near_ua} onChange={set("va_od_near_ua")} opts={VA_NEAR_OPTIONS}/>} right={<EyeInput name="va_os_near_ua" value={f.va_os_near_ua} onChange={set("va_os_near_ua")} opts={VA_NEAR_OPTIONS}/>}/>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Aided (With Current Glasses)</p>
              <RowTable label="Distance" left={<EyeInput name="va_od_dist_a" value={f.va_od_dist_a} onChange={set("va_od_dist_a")} opts={VA_DIST_OPTIONS}/>} right={<EyeInput name="va_os_dist_a" value={f.va_os_dist_a} onChange={set("va_os_dist_a")} opts={VA_DIST_OPTIONS}/>}/>
              <RowTable label="Near" left={<EyeInput name="va_od_near_a" value={f.va_od_near_a} onChange={set("va_od_near_a")} opts={VA_NEAR_OPTIONS}/>} right={<EyeInput name="va_os_near_a" value={f.va_os_near_a} onChange={set("va_os_near_a")} opts={VA_NEAR_OPTIONS}/>}/>
            </div>
          </div>)}

        {/* Step 1: Refraction */}
        {step===1 && (
          <div className="space-y-5">
            <SectionHeader step={2} total={5} title="Refraction" icon={Eye}/>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3 overflow-x-auto">
              <div className="min-w-[440px] space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Auto-Refractor (Objective)</p>
                <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 text-xs font-bold text-slate-500 text-center"><span/>SPH<span>CYL</span><span>AXIS</span></div>
                {[["OD (Right)","ar_od_sph","ar_od_cyl","ar_od_axis"],["OS (Left)","ar_os_sph","ar_os_cyl","ar_os_axis"]].map(([label,s,c,a])=>(
                  <div key={label} className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center">
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <EyeInput name={s} value={f[s]} onChange={set(s)} type="number" step="0.25"/>
                    <EyeInput name={c} value={f[c]} onChange={set(c)} type="number" step="0.25"/>
                    <EyeInput name={a} value={f[a]} onChange={set(a)} type="number" step="1" min="0"/>
                  </div>))}

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-3">Final Subjective Refraction</p>
                <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 text-xs font-bold text-slate-500 text-center"><span/>SPH<span>CYL</span><span>AXIS</span><span>ADD</span><span>VA</span></div>
                {[["OD (Right)","od_sph","od_cyl","od_axis","od_add","od_va"],["OS (Left)","os_sph","os_cyl","os_axis","os_add","os_va"]].map(([label,s,c,a,ad,va])=>(
                  <div key={label} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-center">
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <EyeInput name={s} value={f[s]} onChange={set(s)} type="number" step="0.25"/>
                    <EyeInput name={c} value={f[c]} onChange={set(c)} type="number" step="0.25"/>
                    <EyeInput name={a} value={f[a]} onChange={set(a)} type="number" step="1" min="0"/>
                    <EyeInput name={ad} value={f[ad]} onChange={set(ad)} type="number" step="0.25"/>
                    <EyeInput name={va} value={f[va]} onChange={set(va)} opts={VA_DIST_OPTIONS}/>
                  </div>))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="block"><span className="text-xs text-slate-500">PD Far (mm)</span><EyeInput name="pd_far" value={f.pd_far} onChange={set("pd_far")} type="number" step="0.5"/></label>
                <label className="block"><span className="text-xs text-slate-500">PD Near (mm)</span><EyeInput name="pd_near" value={f.pd_near} onChange={set("pd_near")} type="number" step="0.5"/></label>
              </div>
            </div>
          </div>)}

        {/* Step 2: Clinical */}
        {step===2 && (
          <div className="space-y-4">
            <SectionHeader step={3} total={5} title="Clinical Findings" icon={Eye}/>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Cover Test</span>
                <EyeInput name="cover_test" value={f.cover_test} onChange={set("cover_test")} opts={COVER_TEST_OPTS}/></label>
              <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Colour Vision</span>
                <EyeInput name="colour_vision" value={f.colour_vision} onChange={set("colour_vision")} opts={["normal","defective (red-green)","defective (blue-yellow)"]}/></label>
              <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Confrontation Fields</span>
                <EyeInput name="confrontation" value={f.confrontation} onChange={set("confrontation")} opts={["full","superior defect OD","inferior defect OD","temporal defect OD","superior defect OS","inferior defect OS","temporal defect OS","constricted OU"]}/></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-slate-500">IOP OD (mmHg)</span><EyeInput name="iop_od" value={f.iop_od} onChange={set("iop_od")} type="number" step="0.5" min="0"/></label>
                <label className="block"><span className="text-xs text-slate-500">IOP OS (mmHg)</span><EyeInput name="iop_os" value={f.iop_os} onChange={set("iop_os")} type="number" step="0.5" min="0"/></label>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Anterior Segment</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-slate-500">OD</span><EyeInput name="anterior_od" value={f.anterior_od} onChange={set("anterior_od")} opts={["clear","pterygium","corneal opacity","cataract","pseudophakia","aphakia"]}/></label>
                <label className="block"><span className="text-xs text-slate-500">OS</span><EyeInput name="anterior_os" value={f.anterior_os} onChange={set("anterior_os")} opts={["clear","pterygium","corneal opacity","cataract","pseudophakia","aphakia"]}/></label>
              </div>
            </div>
          </div>)}

        {/* Step 3: Fundus */}
        {step===3 && (
          <div className="space-y-4">
            <SectionHeader step={4} total={5} title="Posterior Segment (Fundus)" icon={Eye}/>
            <p className="text-xs text-slate-500">Leave blank if fundus examination was not performed.</p>
            {["OD (Right Eye)","OS (Left Eye)"].map((eye,ei) => {
              const side = ei===0 ? "od" : "os";
              return (
                <div key={eye} className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">{eye}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label><span className="text-xs text-slate-500">Disc</span><input name={`disc_${side}`} value={f[`disc_${side}`]??""} onChange={e=>set(`disc_${side}`)(e.target.value)} placeholder="pink, sharp margins" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-blue-500 mt-0.5"/></label>
                    <label><span className="text-xs text-slate-500">Cup:Disc Ratio</span><EyeInput name={`cup_disc_${side}`} value={f[`cup_disc_${side}`]} onChange={set(`cup_disc_${side}`)} opts={["0.1","0.2","0.3","0.4","0.5","0.6","0.7","0.8","0.9"]}/></label>
                    <label><span className="text-xs text-slate-500">Macula</span><input name={`macula_${side}`} value={f[`macula_${side}`]??""} onChange={e=>set(`macula_${side}`)(e.target.value)} placeholder="flat & even reflex" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-blue-500 mt-0.5"/></label>
                    <label><span className="text-xs text-slate-500">Vessels</span><input name={`vessels_${side}`} value={f[`vessels_${side}`]??""} onChange={e=>set(`vessels_${side}`)(e.target.value)} placeholder="normal calibre & course" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-blue-500 mt-0.5"/></label>
                  </div>
                </div>);})}
          </div>)}

        {/* Step 4: Final prescription + recommendation */}
        {step===4 && (
          <div className="space-y-4">
            <SectionHeader step={5} total={5} title="Prescription & Advice" icon={Eye}/>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="text-xs font-medium text-slate-600 mb-1 block">Lens Type Prescribed</span>
                <EyeInput name="rx_type" value={f.rx_type} onChange={set("rx_type")} opts={RX_TYPES}/></label>
              <label><span className="text-xs font-medium text-slate-600 mb-1 block">Recommended Index</span>
                <EyeInput name="recommended_index" value={f.recommended_index} onChange={set("recommended_index")} opts={INDEX_OPTS}/></label>
              <label className="sm:col-span-2"><span className="text-xs font-medium text-slate-600 mb-1 block">Lens Recommendation Notes</span>
                <input name="lens_recommendation" value={f.lens_recommendation??""} onChange={e=>set("lens_recommendation")(e.target.value)} placeholder="e.g. Progressive with AR coating recommended. Blue light for screen use." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/></label>
              <label className="sm:col-span-2"><span className="text-xs font-medium text-slate-600 mb-1 block">Clinical Notes</span>
                <textarea name="notes" value={f.notes??""} onChange={e=>set("notes")(e.target.value)} rows={3} placeholder="Any additional findings, referrals, advice given to patient…" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"/></label>
              <label><span className="text-xs font-medium text-slate-600 mb-1 block">Review In</span>
                <EyeInput name="next_review_months" value={f.next_review_months} onChange={set("next_review_months")} opts={MONTHS_OPTS.map(m=>`${m} months`)}/></label>
            </div>
            {/* Summary of Rx */}
            {(f.od_sph || f.os_sph) && (
              <div className="rounded-xl bg-navy-50 border border-navy-100 p-3 text-xs">
                <p className="font-bold text-navy-900 mb-2">Prescription Summary (auto-creates on save)</p>
                <table className="w-full text-center">
                  <thead><tr className="text-slate-500"><th className="text-left">Eye</th><th>SPH</th><th>CYL</th><th>Axis</th><th>ADD</th><th>VA</th></tr></thead>
                  <tbody className="font-semibold text-navy-900">
                    <tr><td className="text-left text-slate-600">OD</td><td>{f.od_sph||"—"}</td><td>{f.od_cyl||"—"}</td><td>{f.od_axis||"—"}</td><td>{f.od_add||"—"}</td><td>{f.od_va||"—"}</td></tr>
                    <tr><td className="text-left text-slate-600">OS</td><td>{f.os_sph||"—"}</td><td>{f.os_cyl||"—"}</td><td>{f.os_axis||"—"}</td><td>{f.os_add||"—"}</td><td>{f.os_va||"—"}</td></tr>
                  </tbody>
                </table>
                <p className="text-slate-500 mt-1">PD: {f.pd_far||"—"} mm · Type: {f.rx_type}</p>
              </div>)}
            {err && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex gap-2"><AlertCircle size={15} className="shrink-0"/>{err}</div>}
          </div>)}
      </div>

      {/* Footer nav */}
      <div className="border-t border-slate-100 p-4 flex gap-3 shrink-0">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</button>
        {step > 0 && <button type="button" onClick={() => setStep(s=>s-1)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 flex items-center gap-1"><ChevronLeft size={15}/>Back</button>}
        {step < STEPS.length-1
          ? <button type="button" onClick={() => setStep(s=>s+1)} className="flex-1 rounded-xl bg-navy-800 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition flex items-center justify-center gap-1">
              Next: {STEPS[step+1]}<ChevronRight size={15}/>
            </button>
          : <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gold-500 py-2.5 text-sm font-bold text-white hover:bg-gold-600 transition disabled:opacity-60 flex items-center justify-center gap-2">
              <Check size={15}/>{saving?"Saving…":"Save Examination & Create Prescription"}
            </button>}
      </div>
    </form>);
}
