"use client";
import { useEffect, useState } from "react";
import { Calendar, Plus, Stethoscope, Check, X, Clock, User, ChevronRight, Eye, Pencil } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ExaminationForm } from "./examination-form";
import { Drawer } from "@poweros/ui";
import { dbError } from "@poweros/business-rules";

const ORG = "00000000-0000-0000-0000-000000000001";
const dStr  = (d:string)  => d ? new Date(d).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"}) : "—";
const tStr  = (t:string)  => t ? t.slice(0,5) : "—";

const STATUS_UI: Record<string,{cls:string;label:string}> = {
  scheduled: {cls:"bg-blue-100 text-blue-700",    label:"Scheduled"},
  confirmed: {cls:"bg-emerald-100 text-emerald-700",label:"Confirmed"},
  arrived:   {cls:"bg-gold-100 text-gold-700",    label:"Arrived"},
  completed: {cls:"bg-slate-100 text-slate-600",  label:"Completed"},
  cancelled: {cls:"bg-rose-100 text-rose-600",    label:"Cancelled"},
  no_show:   {cls:"bg-orange-100 text-orange-600",label:"No Show"},
};
const TYPES=["Eye Test","Contact Lens Fitting","Follow Up","Consultation","Other"];
const STATUSES=["scheduled","confirmed","arrived","completed","cancelled","no_show"];

type Appt = {
  id:string; appt_date:string; appt_time:string; appt_type:string;
  status:string; optometrist:string|null; notes:string|null; duration_mins:number;
  customers?: { id:string; full_name:string; phone:string; customer_code:string } | null;
  branches?:  { name:string } | null;
};
type Cust = { id:string; full_name:string; phone:string; vision_id:string };
type Branch = { id:string; name:string };

export default function AppointmentsPage() {
  const [date,       setDate]       = useState(new Date().toISOString().slice(0,10));
  const [appts,      setAppts]      = useState<Appt[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [examAppt,   setExamAppt]   = useState<Appt|null>(null);
  const [editAppt,   setEditAppt]   = useState<Appt|null>(null);
  const [editBusy,   setEditBusy]   = useState(false);
  const [editF,      setEditF]      = useState<any>({});
  const [updating,   setUpdating]   = useState<string|null>(null);

  // booking drawer state
  const [bookOpen,   setBookOpen]   = useState(false);
  const [bookBusy,   setBookBusy]   = useState(false);
  const [customers,  setCustomers]  = useState<Cust[]>([]);
  const [branches,   setBranches]   = useState<Branch[]>([]);
  const [bookCustId, setBookCustId] = useState("");
  const [bookCq,     setBookCq]     = useState("");
  const [bookF,      setBookF]      = useState<any>({ appt_type:"Eye Test", appt_date:new Date().toISOString().slice(0,10), appt_time:"10:00", duration_mins:"30", optometrist:"", notes:"", status:"scheduled", branch_id: "" });

  async function load() {
    setLoading(true);
    const sb = supabaseBrowser();
    const { data } = await sb.from("appointments")
      .select("id,appt_date,appt_time,appt_type,status,optometrist,notes,duration_mins,customers(id,full_name,phone,customer_code),branches(name)")
      .eq("org_id", ORG).eq("appt_date", date)
      .order("appt_time");
    setAppts((data ?? []) as unknown as Appt[]); setLoading(false);
  }
  useEffect(() => { load(); }, [date]);

  useEffect(() => {
    if (!editAppt) return;
    setEditF({
      appt_type: editAppt.appt_type,
      appt_date: editAppt.appt_date,
      appt_time: editAppt.appt_time?.slice(0,5) ?? "10:00",
      duration_mins: String(editAppt.duration_mins ?? 30),
      optometrist: editAppt.optometrist ?? "",
      notes: editAppt.notes ?? "",
      status: editAppt.status,
    });
  }, [editAppt]);

  // load customers + branches once for the booking drawer
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("customers").select("id,full_name,phone,vision_id").order("full_name").then(({ data }) => setCustomers((data ?? []) as Cust[]));
    sb.from("branches").select("id,name").order("name").then(({ data }) => {
      const bs = (data ?? []) as Branch[];
      setBranches(bs);
      setBookF((f: any) => ({ ...f, branch_id: f.branch_id || bs[0]?.id || "" }));
    });
  }, []);

  async function updateStatus(id:string, status:string) {
    setUpdating(id);
    await supabaseBrowser().from("appointments").update({status}).eq("id",id);
    setUpdating(null); load();
  }

  async function saveEdit() {
    if (!editAppt) return;
    setEditBusy(true);
    const { error } = await supabaseBrowser().from("appointments").update({
      appt_type: editF.appt_type,
      appt_date: editF.appt_date,
      appt_time: editF.appt_time,
      duration_mins: Number(editF.duration_mins) || 30,
      optometrist: editF.optometrist || null,
      notes: editF.notes || null,
      status: editF.status,
      updated_at: new Date().toISOString(),
    }).eq("id", editAppt.id);
    setEditBusy(false);
    if (error) return alert(dbError(error.message));
    setEditAppt(null); load();
  }

  const bookMatchC = customers.filter((c:any) => `${c.full_name} ${c.phone} ${c.vision_id}`.toLowerCase().includes(bookCq.toLowerCase())).slice(0,6);
  const bookSelC = customers.find((c:any) => c.id === bookCustId);

  async function bookSave() {
    if (!bookCustId) return alert("Choose a customer");
    setBookBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.from("appointments").insert({ ...bookF, customer_id: bookCustId, duration_mins: Number(bookF.duration_mins), org_id: ORG });
    setBookBusy(false);
    if (error) return alert(dbError(error.message));
    setBookOpen(false); setBookCustId(""); setBookCq("");
    setBookF({ appt_type:"Eye Test", appt_date: new Date().toISOString().slice(0,10), appt_time:"10:00", duration_mins:"30", optometrist:"", notes:"", status:"scheduled", branch_id: branches[0]?.id ?? "" });
    load();
  }

  const stats = {
    total:     appts.length,
    confirmed: appts.filter(a=>["confirmed","arrived"].includes(a.status)).length,
    completed: appts.filter(a=>a.status==="completed").length,
    pending:   appts.filter(a=>a.status==="scheduled").length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar size={20}/>Appointments</h1>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2 text-sm outline-none focus:border-navy-700"/>
          <button onClick={()=>setBookOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-navy-800 px-4 py-2 text-sm font-bold text-white hover:bg-navy-700">
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
              <button onClick={()=>setBookOpen(true)} className="mt-4 rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700">Book Appointment</button>
            </div>
          : <div className="space-y-3">
              {appts.map(a => {
                const st = STATUS_UI[a.status] ?? STATUS_UI.scheduled;
                const c  = a.customers as any;
                const hasExam = a.status === "completed";
                return (
                  <div key={a.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row gap-3 p-4 items-start">
                      <div className="flex items-center sm:flex-col justify-between sm:justify-center text-center rounded-xl bg-navy-50 px-3 py-2 w-full sm:w-auto sm:min-w-[72px]">
                        <p className="font-extrabold text-lg text-navy-900 leading-tight">{tStr(a.appt_time)}</p>
                        <p className="text-xs text-navy-500">{a.duration_mins}m</p>
                      </div>
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
                      <div className="flex flex-wrap sm:flex-col gap-2 shrink-0 w-full sm:w-auto items-center sm:items-end justify-between sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {["confirmed","arrived","scheduled"].includes(a.status) && c?.id && (
                          <button onClick={()=>setExamAppt(a)}
                            className="flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-2 text-xs font-bold text-white hover:bg-gold-600 transition">
                            <Eye size={13}/>Eye Exam
                          </button>)}
                        <button onClick={()=>setEditAppt(a)}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition">
                          <Pencil size={13}/>Edit
                        </button>
                        {hasExam && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><Check size={12}/>Exam done</span>)}
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

      {/* Booking Drawer */}
      <Drawer open={bookOpen} onClose={()=>setBookOpen(false)} title="Book appointment"
        footer={<><button onClick={()=>setBookOpen(false)} className="btn btn-ghost">Cancel</button><button disabled={bookBusy} onClick={bookSave} className="btn btn-gold">{bookBusy?"Saving…":"Book"}</button></>}>
        <div className="space-y-3">
          {bookSelC ? <div className="flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3"><div><p className="font-semibold">{bookSelC.full_name}</p><p className="text-xs text-slate-500">{bookSelC.phone}</p></div><button onClick={()=>{setBookCustId("");setBookCq("");}} className="text-xs text-navy-700 underline">Change</button></div> :
            <div><div className="relative"><svg className="absolute left-3 top-3.5 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input value={bookCq} onChange={e=>setBookCq(e.target.value)} placeholder="Find customer…" className="field pl-9"/></div>
              <div className="mt-1 space-y-1">{bookMatchC.map((c:any)=><button key={c.id} onClick={()=>{setBookCustId(c.id);setBookCq("");}} className="flex w-full justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-navy-50"><b>{c.full_name}</b><span className="text-slate-500">{c.phone}</span></button>)}</div></div>}
          <label className="block"><span className="mb-1 block text-xs text-slate-500">Type</span><select className="field" value={bookF.appt_type} onChange={e=>setBookF({...bookF,appt_type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Date</span><input type="date" className="field" value={bookF.appt_date} onChange={e=>setBookF({...bookF,appt_date:e.target.value})}/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Time</span><input type="time" className="field" value={bookF.appt_time} onChange={e=>setBookF({...bookF,appt_time:e.target.value})}/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Duration (mins)</span><input type="number" className="field" value={bookF.duration_mins} onChange={e=>setBookF({...bookF,duration_mins:e.target.value})}/></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Optometrist</span><input className="field" value={bookF.optometrist} onChange={e=>setBookF({...bookF,optometrist:e.target.value})}/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-500">Branch</span><select className="field" value={bookF.branch_id} onChange={e=>setBookF({...bookF,branch_id:e.target.value})}>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs text-slate-500">Notes</span><textarea className="field" rows={2} value={bookF.notes} onChange={e=>setBookF({...bookF,notes:e.target.value})}/></label>
        </div>
      </Drawer>
      {/* Edit / Reschedule Drawer */}
      {editAppt && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setEditAppt(null)}/>
          <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
              <p className="font-bold text-lg text-navy-900 flex items-center gap-2"><Pencil size={18}/>Edit appointment</p>
              <button onClick={()=>setEditAppt(null)} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Type</span><select className="field" value={editF.appt_type} onChange={e=>setEditF({...editF,appt_type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="mb-1 block text-xs text-slate-500">Date</span><input type="date" className="field" value={editF.appt_date} onChange={e=>setEditF({...editF,appt_date:e.target.value})}/></label>
                <label className="block"><span className="mb-1 block text-xs text-slate-500">Time</span><input type="time" className="field" value={editF.appt_time} onChange={e=>setEditF({...editF,appt_time:e.target.value})}/></label>
                <label className="block"><span className="mb-1 block text-xs text-slate-500">Duration (mins)</span><input type="number" className="field" value={editF.duration_mins} onChange={e=>setEditF({...editF,duration_mins:e.target.value})}/></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Optometrist</span><input className="field" value={editF.optometrist} onChange={e=>setEditF({...editF,optometrist:e.target.value})}/></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Status</span><select className="field" value={editF.status} onChange={e=>setEditF({...editF,status:e.target.value})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-500">Notes</span><textarea className="field" rows={2} value={editF.notes} onChange={e=>setEditF({...editF,notes:e.target.value})}/></label>
            </div>
            <div className="border-t border-slate-100 p-4 flex gap-2">
              <button onClick={()=>setEditAppt(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button disabled={editBusy} onClick={saveEdit} className="btn btn-gold flex-1">{editBusy?"Saving…":"Save changes"}</button>
            </div>
          </div>
        </div>)}

    </div>);
}