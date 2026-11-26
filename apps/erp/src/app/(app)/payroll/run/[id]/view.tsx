"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { savePayslip, finalizeRun, markPaid } from "../../actions";
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export function RunView({ run, slips }: { run: any; slips: any[] }) {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [vals, setVals] = useState<Record<string, { d: string; o: string; n: string }>>({});
  const [pay, setPay] = useState<{ id: string; method: string; ref: string; date: string } | null>(null);
  const draft = run.status === "draft";
  const go = (fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) => start(async () => { const r = await fn(); setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error }); if (!r.error) after?.(); });
  const v = (s: any) => vals[s.id] ?? { d: String(s.paid_days), o: String(s.other_deduction), n: s.note ?? "" };
  const total = slips.reduce((n, s) => n + Number(s.net), 0);
  const inp = "w-20 rounded border border-slate-300 px-1.5 py-1 text-sm";
  return (<>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><Link href="/payroll" className="text-sm text-slate-500 underline">← Payroll</Link>
      <h1 className="text-xl font-semibold">{new Date(run.period + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })} <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{run.status}</span></h1>
      <p className="text-sm text-slate-500">Net payable {inr(total)}</p></div>
      {draft && <button disabled={pending} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => confirm("Finalise? Paid days and deductions can no longer be edited.") && go(() => finalizeRun(run.id), () => location.reload())}>Finalise payroll</button>}</div>
    {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="p-2">Employee</th><th>Paid days</th><th>Gross</th><th>PF</th><th>ESI</th><th>PT</th><th>Other ded.</th><th>Net</th><th></th></tr></thead><tbody>
      {slips.map(s => <tr key={s.id} className="border-t"><td className="p-2">{s.name}<div className="text-xs text-slate-400">of {s.days_in_month} days</div></td>
        <td>{draft ? <input className={inp} inputMode="decimal" value={v(s).d} onChange={e => setVals({ ...vals, [s.id]: { ...v(s), d: e.target.value } })} /> : Number(s.paid_days)}</td>
        <td>{inr(s.gross)}</td><td>{inr(s.pf)}</td><td>{inr(s.esi)}</td><td>{inr(s.professional_tax)}</td>
        <td>{draft ? <input className={inp} inputMode="decimal" value={v(s).o} onChange={e => setVals({ ...vals, [s.id]: { ...v(s), o: e.target.value } })} /> : inr(s.other_deduction)}</td>
        <td className="font-medium">{inr(s.net)}</td>
        <td className="space-x-3 whitespace-nowrap pr-2 text-right">
          {draft && <button className="text-brand-700 underline" disabled={pending} onClick={() => go(() => savePayslip(s.id, Number(v(s).d), Number(v(s).o), v(s).n), () => location.reload())}>Save</button>}
          {!draft && (s.paid_on ? <span className="text-emerald-700">Paid {s.paid_on}</span> : <button className="text-brand-700 underline" onClick={() => setPay({ id: s.id, method: "bank", ref: "", date: new Date().toISOString().slice(0, 10) })}>Mark paid</button>)}
          <Link href={`/payroll/slip/${s.id}`} className="text-slate-600 underline">Payslip</Link></td></tr>)}
    </tbody></table></div>
    {pay && <div className="rounded-xl border bg-white p-4"><p className="mb-2 text-sm font-medium">Record payment</p><div className="flex flex-wrap items-end gap-2">
      <select className="rounded border px-2 py-1.5 text-sm" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>{["bank", "cash", "upi", "cheque"].map(m => <option key={m}>{m}</option>)}</select>
      <input className="rounded border px-2 py-1.5 text-sm" placeholder="Reference (optional)" value={pay.ref} onChange={e => setPay({ ...pay, ref: e.target.value })} />
      <input type="date" className="rounded border px-2 py-1.5 text-sm" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} />
      <button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => go(() => markPaid(pay.id, pay.method, pay.ref, pay.date), () => location.reload())}>Save</button>
      <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => setPay(null)}>Cancel</button></div></div>}
  </>);
}
