"use client";
import { useState, useTransition } from "react";
import { decideLeave, recordLeave, saveHoliday, saveLeaveType } from "./actions";

const fmt = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function LeaveView({ requests, staff, types, holidays }: {
  requests: any[]; staff: any[]; types: any[]; holidays: any[];
}) {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [leave, setLeave] = useState({
    profile_id: staff[0]?.id ?? "", leave_type_id: types[0]?.id ?? "",
    from_date: new Date().toISOString().slice(0, 10), to_date: new Date().toISOString().slice(0, 10),
    days: "1", reason: "",
  });
  const [lt, setLt] = useState({ id: "", code: "", name: "", is_paid: true, is_active: true });
  const [hol, setHol] = useState({ id: "", name: "", holiday_date: new Date().toISOString().slice(0, 10) });
  const run = (fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error });
      if (!r.error) after?.();
    });
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.full_name
    ?? requests.find((r) => r.profile_id === id)?.profiles?.full_name ?? "—";
  const typeOf = (id: string) => types.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div><h1 className="font-display text-2xl font-semibold">Leave management</h1>
        <p className="text-sm text-slate-500">Approved paid leave automatically creates attendance; unpaid leave creates zero-paid days.</p></div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}

      <section className="card p-4">
        <h2 className="mb-3 font-medium">Record leave</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-600">Employee
            <select className="field mt-1" value={leave.profile_id} onChange={(e) => setLeave({ ...leave, profile_id: e.target.value })}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></label>
          <label className="text-xs text-slate-600">Leave type
            <select className="field mt-1" value={leave.leave_type_id} onChange={(e) => setLeave({ ...leave, leave_type_id: e.target.value })}>
              {types.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
          <label className="text-xs text-slate-600">Days
            <input inputMode="decimal" className="field mt-1" value={leave.days} onChange={(e) => setLeave({ ...leave, days: e.target.value })} /></label>
          <label className="text-xs text-slate-600">From
            <input type="date" className="field mt-1" value={leave.from_date} onChange={(e) => setLeave({ ...leave, from_date: e.target.value })} /></label>
          <label className="text-xs text-slate-600">To
            <input type="date" className="field mt-1" value={leave.to_date} onChange={(e) => setLeave({ ...leave, to_date: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Reason
            <input className="field mt-1" value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} placeholder="Optional" /></label>
        </div>
        <div className="mt-3"><button disabled={pending || !leave.profile_id || !leave.leave_type_id} className="btn btn-primary"
          onClick={() => run(() => recordLeave({ ...leave, days: Number(leave.days) }))}>Record leave</button></div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b px-4 py-3"><h2 className="font-medium">Requests · {requests.length}</h2></div>
        {requests.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No leave requests yet.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th></th></tr></thead>
            <tbody>{requests.map((r) => <tr key={r.id} className="border-t">
              <td className="p-2">{nameOf(r.profile_id)}</td><td className="text-center">{typeOf(r.leave_type_id)}</td>
              <td className="text-center">{fmt(r.from_date)}</td><td className="text-center">{fmt(r.to_date)}</td>
              <td className="text-center">{Number(r.days)}</td>
              <td className="text-center capitalize"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
              <td className="py-1 pr-2 text-right whitespace-nowrap">{r.status === "pending" && <>
                <button disabled={pending} className="text-emerald-700 underline" onClick={() => run(() => decideLeave(r.id, true))}>Approve</button>
                <button disabled={pending} className="ml-3 text-red-600 underline" onClick={() => run(() => decideLeave(r.id, false))}>Reject</button>
              </>}</td>
            </tr>)}</tbody></table></div>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-medium">Leave types</h2>
          <div className="space-y-2">{types.map((t) => <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span><b>{t.name}</b> <span className="text-xs text-slate-500">{t.code} · {t.is_paid ? "paid" : "unpaid"}{!t.is_active ? " · inactive" : ""}</span></span>
            <button className="text-brand-700 underline" onClick={() => setLt({ id: t.id, code: t.code, name: t.name, is_paid: t.is_paid, is_active: t.is_active })}>Edit</button>
          </div>)}</div>
          <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Code<input className="field mt-1" value={lt.code} onChange={(e) => setLt({ ...lt, code: e.target.value })} /></label>
            <label className="text-xs text-slate-600">Name<input className="field mt-1" value={lt.name} onChange={(e) => setLt({ ...lt, name: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={lt.is_paid} onChange={(e) => setLt({ ...lt, is_paid: e.target.checked })} /> Paid leave</label>
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={lt.is_active} onChange={(e) => setLt({ ...lt, is_active: e.target.checked })} /> Active</label>
          </div>
          <div className="mt-3 flex gap-2"><button disabled={pending} className="btn btn-primary"
            onClick={() => run(() => saveLeaveType(lt), () => setLt({ id: "", code: "", name: "", is_paid: true, is_active: true }))}>{lt.id ? "Update type" : "Add type"}</button>
            {lt.id && <button className="btn btn-ghost" onClick={() => setLt({ id: "", code: "", name: "", is_paid: true, is_active: true })}>Cancel</button>}</div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Holidays</h2>
          <div className="space-y-2">{holidays.map((h) => <div key={h.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>{fmt(h.holiday_date)} · {h.name}</span>
            <button className="text-brand-700 underline" onClick={() => setHol({ id: h.id, name: h.name, holiday_date: h.holiday_date })}>Edit</button>
          </div>)}</div>
          {holidays.length === 0 && <p className="py-3 text-sm text-slate-500">No holidays configured.</p>}
          <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Name<input className="field mt-1" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} /></label>
            <label className="text-xs text-slate-600">Date<input type="date" className="field mt-1" value={hol.holiday_date} onChange={(e) => setHol({ ...hol, holiday_date: e.target.value })} /></label>
          </div>
          <div className="mt-3 flex gap-2"><button disabled={pending} className="btn btn-primary"
            onClick={() => run(() => saveHoliday(hol), () => setHol({ id: "", name: "", holiday_date: new Date().toISOString().slice(0, 10) }))}>{hol.id ? "Update holiday" : "Add holiday"}</button>
            {hol.id && <button className="btn btn-ghost" onClick={() => setHol({ id: "", name: "", holiday_date: new Date().toISOString().slice(0, 10) })}>Cancel</button>}</div>
        </section>
      </div>
    </div>
  );
}
