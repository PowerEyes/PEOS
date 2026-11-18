"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer, Pill, useToast } from "@poweros/ui";
import { CalendarDays, Plus, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { revalidatePath } from "next/cache";

const TYPES=["Eye Test","Contact Lens Fitting","Follow Up","Consultation","Other"];
const STATUSES=["scheduled","confirmed","arrived","completed","cancelled","no_show"];
const TONE:any={scheduled:"gold",confirmed:"blue",arrived:"green",completed:"green",cancelled:"red",no_show:"grey"};
const L=({t,children}:{t:string;children:React.ReactNode})=><label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;

export function ApptsView({ appts, customers, branches }:any) {
  const router=useRouter(); const toast=useToast();
  const [q,setQ]=useState(""); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false);
  const [custId,setCustId]=useState(""); const [cq,setCq]=useState("");
  const [f,setF]=useState<any>({ appt_type:"Eye Test", appt_date:new Date().toISOString().slice(0,10), appt_time:"10:00", duration_mins:"30", optometrist:"", notes:"", status:"scheduled", branch_id: branches[0]?.id??""});
  const matchC=customers.filter((c:any)=>`${c.full_name} ${c.phone} ${c.vision_id}`.toLowerCase().includes(cq.toLowerCase())).slice(0,5);
  const selC=customers.find((c:any)=>c.id===custId);
  const rows=appts.filter((a:any)=>`${a.customers?.full_name} ${a.customers?.phone} ${a.appt_type}`.toLowerCase().includes(q.toLowerCase()));
  const grouped=rows.reduce((m:any,a:any)=>{const d=a.appt_date;m[d]=[...(m[d]??[]),a];return m;},{});
  async function save(){
    if(!custId) return toast("Choose a customer","err"); setBusy(true);
    const { error } = await supabaseBrowser().from("appointments").insert({...f,customer_id:custId,duration_mins:Number(f.duration_mins)});
    setBusy(false); if(error) return toast(error.message,"err"); toast("Appointment booked"); router.refresh(); setOpen(false); setCustId(""); setCq("");
  }
  async function updStatus(id:string, status:string){
    const { error } = await supabaseBrowser().from("appointments").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    if(error) toast(error.message,"err"); else { toast("Updated"); router.refresh(); }
  }
  return(<div className="mx-auto max-w-4xl space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="font-display text-3xl font-semibold">Appointments</h1><p className="text-slate-500">Eye tests and consultations — upcoming {appts.length}</p></div>
      <button onClick={()=>setOpen(true)} className="btn btn-primary"><Plus size={16}/>Book appointment</button></div>
    <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} className="field pl-9" placeholder="Search by customer or type…"/></div>
    {Object.keys(grouped).length===0?<div className="card p-10 text-center text-slate-500"><CalendarDays className="mx-auto mb-2"/>No upcoming appointments. Book one to get started.</div>:
      Object.entries(grouped).map(([date,list]:any)=><div key={date}>
        <p className="mb-2 text-sm font-semibold text-slate-500">{new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</p>
        <div className="card divide-y divide-slate-100 overflow-hidden">{list.map((a:any)=>{
          const ph=a.customers?.whatsapp||a.customers?.phone||"";
          const apptDate = new Date(a.appt_date+"T00:00:00").toLocaleDateString("en-IN",{dateStyle:"medium"});
          return(<div key={a.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-16 text-center"><p className="font-bold">{a.appt_time?.slice(0,5)}</p><p className="text-xs text-slate-500">{a.duration_mins}m</p></div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{a.customers?.full_name}</p><p className="text-xs text-slate-500">{a.appt_type}{a.optometrist?` | ${a.optometrist}`:""}{a.notes?` | ${a.notes}`:""}</p></div>
            <select value={a.status} onChange={e=>updStatus(a.id,e.target.value)} className="field w-auto py-1.5 text-xs">{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
            <Pill tone={TONE[a.status]}>{a.status}</Pill>
            <WhatsAppSend phone={ph} keys={["appointment_reminder","appointment_confirmed","welcome"]} defaultKey="appointment_reminder"
              label="" className="btn btn-ghost !p-2 text-emerald-600"
              vars={{ Name: a.customers?.full_name ?? "", Type: a.appt_type, Date: apptDate, Time: a.appt_time }} />
          </div>);})}
        </div></div>)}
    <Drawer open={open} onClose={()=>setOpen(false)} title="Book appointment" footer={<><button onClick={()=>setOpen(false)} className="btn btn-ghost">Cancel</button><button disabled={busy} onClick={save} className="btn btn-gold">{busy?"Saving…":"Book"}</button></>}>
      <div className="space-y-3">
        {selC?<div className="flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3"><div><p className="font-semibold">{selC.full_name}</p><p className="text-xs text-slate-500">{selC.phone}</p></div><button onClick={()=>{setCustId("");setCq("");}} className="text-xs text-navy-700 underline">Change</button></div>:
          <div><div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-slate-400"/><input value={cq} onChange={e=>setCq(e.target.value)} placeholder="Find customer…" className="field pl-9"/></div>
            <div className="mt-1 space-y-1">{matchC.map((c:any)=><button key={c.id} onClick={()=>{setCustId(c.id);setCq("");}} className="flex w-full justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-navy-50"><b>{c.full_name}</b><span className="text-slate-500">{c.phone}</span></button>)}</div></div>}
        <L t="Type"><select className="field" value={f.appt_type} onChange={e=>setF({...f,appt_type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></L>
        <div className="grid gap-3 sm:grid-cols-3"><L t="Date"><input type="date" className="field" value={f.appt_date} onChange={e=>setF({...f,appt_date:e.target.value})}/></L><L t="Time"><input type="time" className="field" value={f.appt_time} onChange={e=>setF({...f,appt_time:e.target.value})}/></L><L t="Duration (mins)"><input type="number" className="field" value={f.duration_mins} onChange={e=>setF({...f,duration_mins:e.target.value})}/></L></div>
        <div className="grid gap-3 sm:grid-cols-2"><L t="Optometrist"><input className="field" value={f.optometrist} onChange={e=>setF({...f,optometrist:e.target.value})}/></L><L t="Branch"><select className="field" value={f.branch_id} onChange={e=>setF({...f,branch_id:e.target.value})}>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></L></div>
        <L t="Notes"><textarea className="field" rows={2} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></L></div></Drawer></div>);
}
