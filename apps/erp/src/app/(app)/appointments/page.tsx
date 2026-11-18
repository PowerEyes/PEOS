
"use client";
import { useEffect, useState } from "react";
import { Calendar, Plus, Stethoscope, Check, X, Clock, User, ChevronRight, Eye } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ExaminationForm } from "./examination-form";

const ORG = "00000000-0000-0000-0000-000000000001";
const dStr  = (d:string)  => d ? new Date(d).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"}) : "—";
const tStr  = (t:string)  => t ? t.slice(0,5) : "—";
const inr   = (n:any)     => `₹${Number(n||0).toLocaleString("en-IN")}`;

const STATUS_UI: Record<string,{cls:string;label:string}> = {
  scheduled: {cls:"bg-blue-100 text-blue-700",    label:"Scheduled"},
  confirmed: {cls:"bg-emerald-100 text-emerald-700",label:"Confirmed"},
  arrived:   {cls:"bg-gold-100 text-gold-700",    label:"Arrived"},
  completed: {cls:"bg-slate-100 text-slate-600",  label:"Completed"},
  cancelled: {cls:"bg-rose-100 text-rose-600",    label:"Cancelled"},
  no_show:   {cls:"bg-orange-100 text-orange-600",label:"No Show"},
};

type Appt = {
  id:string; appt_date:string; appt_time:string; appt_type:string;
  status:string; optometrist:string|null; notes:string|null; duration_mins:number;
  customers?: { id:string; full_name:string; phone:string; customer_code:string } | null;
  branches?:  { name:string } | null;
};

export default function AppointmentsPage() {
  const [date,       setDate]       = useState(new Date().toISOString().slice(0,10));
  const [appts,      setAppts]      = useState<Appt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [examAppt,   setExamAppt]   = useState<Appt|null>(null);  // ← NEW: exam drawer
  const [addOpen,    setAddOpen]    = useState(false);
  const [updating,   setUpdating]   = useState<string|null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabaseBrowser().from("appointments")
      .select("id,appt_date,appt_time,appt_type,status,optometrist,notes,duration_mins,customers(id,full_name,phone,customer_code),branches(name)")
      .eq("org_id", ORG).eq("appt_date", date)
      .order("appt_time");
    setAppts((data ?? []) as unknown as Appt[]); setLoading(false);
  }
  useEffect(() => { load(); }, [date]);

  async function updateStatus(id:string, status:string) {
    setUpdating(id);
    await supabaseBrowser().from("appointments").update({status}).eq("id",id);
    setUpdating(null); load();
  }

  const stats = {
    total:     appts.length,
    confirmed: appts.filter(a=>["confirmed","arrived"].includes(a.status)).length,
    completed: appts.filter(a=>a.status==="completed").length,
    pending:   appts.filter(a=>a.status==="scheduled").length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar size={20}/>Appointments</h1>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-navy-700"/>
          <button onClick={()=>setAddOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-navy-800 px-4 py-2 text-sm font-bold text-white hover:bg-navy-700">
            <Plus size={15}/>Book
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Total",stats.total,"bg-blue-50 text-blue-700"],["Confirmed",stats.confirmed,"bg-emerald-50 text-emerald-700"],["Completed",stats.completed,"bg-slate-50 text-slate-600"],["Pending",stats.pending,"bg-amber-50 text-amber-700"]].map(([l,v,cls])=>(
          <div key={l as string} className={`rounded-2xl border p-3 text-center ${cls}`}>
            <p className="font-extrabold text-2xl">{v}</p>
            <p className="text-xs font-medium mt-0.5">{l}</p>
          </div>))}
      </div>

      {/* Appointments list */}
      {loading
        ? <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">Loading…</div>
        : appts.length === 0
          ? <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
              <Calendar size={36} className="mx-auto mb-3 text-slate-200"/>
              <p className="font-semibold text-slate-600">No appointments on {dStr(date)}</p>
              <button onClick={()=>setAddOpen(true)} className="mt-4 rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700">Book Appointment</button>
            </div>
          : <div className="space-y-3">
              {appts.map(a => {
                const st = STATUS_UI[a.status] ?? STATUS_UI.scheduled;
                const c  = a.customers as any;
                const hasExam = a.status === "completed";
                return (
                  <div key={a.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex flex-wrap gap-3 p-4 items-start">
                      {/* Time block */}
                      <div className="text-center rounded-xl bg-navy-50 px-3 py-2 min-w-[72px]">
                        <p className="font-extrabold text-lg text-navy-900 leading-tight">{tStr(a.appt_time)}</p>
                        <p className="text-xs text-navy-500">{a.duration_mins}m</p>
                      </div>
                      {/* Customer + type */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-navy-900">{c?.full_name ?? "Walk-in"}</p>
                          <span className="text-xs text-slate-400">{c?.customer_code}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{a.appt_type}</p>
                        {c?.phone && <p className="text-xs text-slate-400 mt-0.5">📞 {c.phone}</p>}
                        {a.optometrist && <p className="text-xs text-slate-400 mt-0.5">👨‍⚕️ {a.optometrist}</p>}
                        {a.notes && <p className="text-xs text-slate-500 mt-1 italic">"{a.notes}"</p>}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {/* ── Eye Exam button — the new wiring ── */}
                        {["confirmed","arrived","scheduled"].includes(a.status) && c?.id && (
                          <button onClick={()=>setExamAppt(a)}
                            className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-2 text-xs font-bold text-white hover:bg-gold-600 transition">
                            <Eye size={13}/>Eye Exam
                          </button>)}
                        {hasExam && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><Check size={12}/>Exam done</span>)}
                        {/* Status flow buttons */}
                        <div className="flex gap-1 flex-wrap">
                          {a.status==="scheduled" && (
                            <button onClick={()=>updateStatus(a.id,"confirmed")} disabled={updating===a.id}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={12}/></button>)}
                          {a.status==="confirmed" && (
                            <button onClick={()=>updateStatus(a.id,"arrived")} disabled={updating===a.id}
                              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Arrived</button>)}
                          {["confirmed","arrived"].includes(a.status) && (
                            <button onClick={()=>updateStatus(a.id,"completed")} disabled={updating===a.id}
                              className="rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50">Done</button>)}
                          {["scheduled","confirmed"].includes(a.status) && (
                            <button onClick={()=>updateStatus(a.id,"cancelled")} disabled={updating===a.id}
                              className="rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-200 disabled:opacity-50"><X size={12}/></button>)}
                        </div>
                      </div>
                    </div>
                  </div>);})}
            </div>}

      {/* Eye Examination Drawer */}
      {examAppt && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={()=>{setExamAppt(null);load();}}/>
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <div>
                <p className="font-bold text-lg text-navy-900 flex items-center gap-2"><Eye size={18}/>Eye Examination</p>
                <p className="text-sm text-slate-500 mt-0.5">{(examAppt.customers as any)?.full_name} · {dStr(examAppt.appt_date)} {tStr(examAppt.appt_time)}</p>
              </div>
              <button onClick={()=>{setExamAppt(null);load();}} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ExaminationForm
                customerId={(examAppt.customers as any)?.id ?? ""}
                appointmentId={examAppt.id}
                onClose={()=>{setExamAppt(null);load();}}/>
            </div>
          </div>
        </div>)}
    </div>);
}
