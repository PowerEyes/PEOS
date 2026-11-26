"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { saveSalary, removeSalary, generateRun, deleteRun } from "./actions";
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const F = ["basic", "hra", "other_allowance", "pf_pct", "esi_pct", "professional_tax"] as const;
const L: Record<string, string> = { basic: "Basic", hra: "HRA", other_allowance: "Other allowance", pf_pct: "PF %", esi_pct: "ESI %", professional_tax: "Prof. tax" };
export function PayrollView({ staff, salaries, runs }: { staff: any[]; salaries: any[]; runs: any[] }) {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pending, start] = useTransition();
  const sal = new Map(salaries.map(s => [s.profile_id, s]));
  const run = (fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) => start(async () => { const r = await fn(); setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error }); if (!r.error) after?.(); });
  const open = (id: string) => { const s = sal.get(id); setEdit(id); setForm({ ...Object.fromEntries(F.map(k => [k, String(s?.[k] ?? 0)])), effective_from: s?.effective_from ?? new Date().toISOString().slice(0, 10) }); };
  const inp = "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm";
  return (<>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-semibold">Payroll</h1><p className="text-sm text-slate-500">Set salaries, run monthly payroll, finalise and record payments.</p></div>
      <Link href="/payroll/mine" className="text-sm text-brand-700 underline">My payslips</Link></div>
    {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-medium">Monthly runs</h2>
      <div className="mb-3 flex flex-wrap items-end gap-2"><label className="text-sm">Month<input type="month" value={month} max={new Date().toISOString().slice(0, 7)} onChange={e => setMonth(e.target.value)} className={inp + " mt-1"} /></label>
        <button disabled={pending} onClick={() => run(() => generateRun(month))} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">Generate payroll</button></div>
      {runs.length === 0 ? <p className="text-sm text-slate-500">No payroll runs yet. Add salaries below, then generate a month.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-1">Month</th><th>Status</th><th>Staff</th><th>Net payable</th><th></th></tr></thead><tbody>
          {runs.map(r => <tr key={r.id} className="border-t"><td className="py-2">{mon(r.period)}</td><td className="capitalize">{r.status}</td><td>{r.count}</td><td>{inr(r.total)}</td>
            <td className="space-x-3 text-right"><Link className="text-brand-700 underline" href={`/payroll/run/${r.id}`}>Open</Link>
              {r.status === "draft" && <button className="text-red-600 underline" onClick={() => confirm("Delete this draft?") && run(() => deleteRun(r.id))}>Delete</button>}</td></tr>)}
        </tbody></table></div>}</section>
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-medium">Salary structures</h2>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-1">Employee</th><th>Role</th><th>Basic</th><th>Gross</th><th></th></tr></thead><tbody>
        {staff.map(p => { const s = sal.get(p.id); return (<tr key={p.id} className="border-t align-top"><td className="py-2">{p.full_name}</td><td className="capitalize">{p.role_key}</td>
          <td>{s ? inr(s.basic) : <span className="text-amber-600">Not set</span>}</td><td>{s ? inr(Number(s.basic) + Number(s.hra) + Number(s.other_allowance)) : "—"}</td>
          <td className="space-x-3 text-right"><button className="text-brand-700 underline" onClick={() => open(p.id)}>{s ? "Edit" : "Set salary"}</button>
            {s && <button className="text-red-600 underline" onClick={() => confirm("Remove this salary?") && run(() => removeSalary(p.id))}>Remove</button>}</td></tr>); })}
      </tbody></table></div>
      {edit && <div className="mt-4 rounded-lg border bg-slate-50 p-3"><p className="mb-2 text-sm font-medium">{staff.find(p => p.id === edit)?.full_name}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{F.map(k => <label key={k} className="text-xs text-slate-600">{L[k]}<input inputMode="decimal" value={form[k] ?? ""} onChange={e => setForm({ ...form, [k]: e.target.value })} className={inp + " mt-1"} /></label>)}
          <label className="text-xs text-slate-600">Effective from<input type="date" value={form.effective_from ?? ""} onChange={e => setForm({ ...form, effective_from: e.target.value })} className={inp + " mt-1"} /></label></div>
        <div className="mt-3 flex gap-2"><button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => run(() => saveSalary(edit, { ...Object.fromEntries(F.map(k => [k, Number(form[k])])), effective_from: form.effective_from } as any), () => setEdit(null))}>Save</button>
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setEdit(null)}>Cancel</button></div></div>}
    </section></>);
}
