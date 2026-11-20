"use client";
import { useState } from "react";
import { Check, Calendar, Clock, MapPin, User } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";
const TYPES = ["Comprehensive Eye Test","Contact Lens Fitting","Follow Up","Consultation"];
const TIMES = ["09:30 AM","10:00 AM","10:30 AM","11:00 AM","02:00 PM","02:30 PM","03:00 PM","04:00 PM","04:30 PM"];
export function EyeTestBooking() {
  const { whatsappNumber } = useSite();
  const [branch,setBranch]=useState(""); const [type,setType]=useState(""); const [date,setDate]=useState(""); const [time,setTime]=useState(""); const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [done,setDone]=useState(false);
  function submit() {
    if (!branch||!type||!date||!time||!name||!phone) return;
    const msg=`Hello, I'd like to book a ${type} at Power Eyes Opticals ${branch} on ${new Date(date).toLocaleDateString("en-IN",{dateStyle:"long"})} at ${time}.\nName: ${name}\nPhone: ${phone}`;
    window.open(waHref(whatsappNumber, msg),"_blank"); setDone(true);
  }
  if (done) return <div className="mx-auto max-w-lg px-4 py-20 text-center"><div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald-50"><Check className="text-emerald-500" size={40}/></div><h2 className="font-display text-3xl font-bold text-navy-900">Booking Requested!</h2><p className="mt-2 text-slate-500">WhatsApp opened with your details. Our team will confirm shortly.</p><button onClick={()=>setDone(false)} className="btn-gold mt-6">Book Another</button></div>;
  return (<div className="mx-auto max-w-2xl section-pad px-4">
    <div className="text-center mb-10"><h1 className="font-display text-4xl font-bold text-navy-900">Book an Eye Test</h1><p className="mt-2 text-slate-500">Professional eye care at our Mogappair stores</p></div>
    <div className="card p-6 space-y-5">
      <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-700"><MapPin size={15}/>Choose store</p>
        <div className="grid grid-cols-2 gap-3">{["Mogappair East","Mogappair West"].map(b=><button key={b} onClick={()=>setBranch(b)} className={`rounded-2xl border-2 p-3 sm:p-4 text-xs sm:text-sm font-medium transition text-center ${branch===b?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-300"}`}>{b}</button>)}</div></div>
      <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-700"><Calendar size={15}/>Appointment type</p>
        <div className="grid gap-2">{TYPES.map(t=><button key={t} onClick={()=>setType(t)} className={`rounded-xl border-2 px-4 py-2.5 text-left text-sm transition ${type===t?"border-gold-500 bg-amber-50":"border-slate-100 hover:border-slate-300"}`}>{t}</button>)}</div></div>
      <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-700"><Calendar size={15}/>Date</p>
        <input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></div>
      {date&&<div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-700"><Clock size={15}/>Time</p>
        <div className="flex flex-wrap gap-2">{TIMES.map(t=><button key={t} onClick={()=>setTime(t)} className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${time===t?"border-gold-500 bg-amber-50 text-gold-700":"border-slate-200 hover:border-navy-700"}`}>{t}</button>)}</div></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-700"><User size={15}/>Your name</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></div>
        <div><p className="mb-2 text-sm font-semibold text-navy-700">Phone</p><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98401 85186" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></div>
      </div>
      <button onClick={submit} disabled={!branch||!type||!date||!time||!name||!phone} className="btn-gold w-full py-4 text-base disabled:opacity-50">💬 Confirm via WhatsApp</button>
      <p className="text-center text-xs text-slate-400">Opens WhatsApp with your appointment details. We confirm within 30 minutes.</p>
    </div></div>);
}
