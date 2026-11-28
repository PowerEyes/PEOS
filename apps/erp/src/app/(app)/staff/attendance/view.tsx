"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance, deleteAttendance } from "./actions";

const STATUS = [
  ["present", "Present"], ["half_day", "Half day"], ["absent", "Absent"],
  ["leave", "Leave"], ["weekly_off", "Weekly off"], ["holiday", "Holiday"],
] as const;
const DEFAULT_PAID: Record<string, string> = {
  present: "1", half_day: "0.5", absent: "0", leave: "1", weekly_off: "0", holiday: "1",
};
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function AttendanceView({ month, staff, rows, types }: {
  month: string; staff: any[]; rows: any[]; types: any[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    profile_id: staff[0]?.id ?? "",
    work_date: `${month}-01`,
    status: "present",
    leave_type_id: "",
    paid_days: "1",
    note: "",
  });
  const run = (fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error });
      if (!r.error) after?.();
    });

  const byEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.profile_id, (m.get(r.profile_id) ?? 0) + Number(r.paid_days));
    return m;
  }, [rows]);
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.full_name ?? rows.find((r) => r.profile_id === id)?.profiles?.full_name ?? "—";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold">Attendance</h1>
          <p className="text-sm text-slate-500">Mark daily attendance; paid days feed the monthly payroll run.</p></div>
        <label className="text-xs text-slate-600">Month
          <input type="month" className="field mt-1" value={month} onChange={(e) => e.target.value && router.push(`/staff/attendance?month=${e.target.value}`)} />
        </label>
      </div>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}

      <section className="card p-4">
        <h2 className="mb-3 font-medium">Mark a day</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-600">Employee
            <select className="field mt-1" value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></label>
          <label className="text-xs text-slate-600">Date
            <input type="date" className="field mt-1" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Status
            <select className="field mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, paid_days: DEFAULT_PAID[e.target.value] ?? "0" })}>
              {STATUS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select></label>
          {form.status === "leave" && <label className="text-xs text-slate-600">Leave type
            <select className="field mt-1" value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
              <option value="">Approved leave already recorded</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_paid ? " (paid)" : " (unpaid)"}</option>)}
            </select></label>}
          <label className="text-xs text-slate-600">Paid days
            <input inputMode="decimal" className="field mt-1" value={form.paid_days} onChange={(e) => setForm({ ...form, paid_days: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Note
            <input className="field mt-1" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" /></label>
        </div>
        <div className="mt-3"><button disabled={pending || !form.profile_id} className="btn btn-primary"
          onClick={() => run(() => saveAttendance({ ...form, paid_days: Number(form.paid_days) }))}>Save attendance</button></div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b px-4 py-3"><h2 className="font-medium">Marked days · {rows.length}</h2>
          <p className="text-xs text-slate-500">Employees with no entry for the month are treated as full-attendance in payroll.</p></div>
        {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nothing marked for this month yet.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">Employee</th><th>Date</th><th>Status</th><th>Paid days</th><th>Note</th><th></th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="border-t">
              <td className="p-2">{nameOf(r.profile_id)}</td><td className="text-center">{mon(r.work_date)}</td>
              <td className="text-center capitalize">{(r.status ?? "").replace("_", " ")}</td>
              <td className="text-center font-medium">{Number(r.paid_days)}</td>
              <td className="text-center text-xs text-slate-500">{r.note ?? "—"}</td>
              <td className="py-1 text-right pr-2"><button disabled={pending} className="text-red-600 underline" onClick={() => run(() => deleteAttendance(r.id))}>Delete</button></td>
            </tr>)}</tbody></table></div>}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-medium">Month totals</h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {staff.map((s) => <div key={s.id} className="rounded-lg border p-2 text-sm">
            <p className="truncate font-medium">{s.full_name}</p>
            <p className="text-xs text-slate-500">{byEmployee.get(s.id) ?? 0} paid days marked</p>
          </div>)}
        </div>
      </section>
    </div>
  );
}
