"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { importStatement, autoMatch, matchLine, setLine } from "./actions";
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const TABS = ["unmatched", "matched", "ignored"];
export function BankView({ status, counts, rows }: { status: string; counts: number[]; rows: any[] }) {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [bank, setBank] = useState("Bank"); const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ error?: string; ok?: string }>) => start(async () => { const r = await fn(); setMsg({ t: r.error ?? r.ok ?? "", bad: !!r.error }); });
  const upload = (f?: File | null) => { if (f) f.text().then(t => go(() => importStatement(t, bank))); };
  return (<>
    <div><h1 className="text-xl font-semibold">Bank reconciliation</h1><p className="text-sm text-slate-500">Import a bank statement CSV and match each line with a recorded card, UPI, bank or online payment.</p></div>
    {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.bad ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.t}</p>}
    <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 text-sm">
      <label>Account name<input value={bank} onChange={e => setBank(e.target.value)} maxLength={40} className="mt-1 block rounded border px-2 py-1.5" /></label>
      <label>Statement CSV<input type="file" accept=".csv,text/csv" disabled={pending} onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} className="mt-1 block" /></label>
      <button disabled={pending} onClick={() => go(autoMatch)} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50">Auto-match</button>
      <p className="basis-full text-xs text-slate-500">Columns: Date, Description, Reference, Debit (or Withdrawal), Credit (or Deposit). Re-importing the same lines is safe; duplicates are skipped.</p></section>
    <div className="flex gap-2 text-sm">{TABS.map((t, i) => <Link key={t} href={`?s=${t}`} className={`rounded-full border px-3 py-1 capitalize ${t === status ? "bg-slate-900 text-white" : "bg-white"}`}>{t} ({counts[i]})</Link>)}</div>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="p-2">Date</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="pl-4">Action</th></tr></thead><tbody>
      {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-slate-500">Nothing here.</td></tr>}
      {rows.map(r => <tr key={r.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{r.txn_date}</td><td>{r.description}<div className="text-xs text-slate-400">{r.bank_label}{r.reference ? ` · ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}{r.status === "matched" ? ` · ${r.matched_kind}` : ""}</div></td>
        <td className="text-right">{Number(r.debit) ? inr(r.debit) : ""}</td><td className="text-right">{Number(r.credit) ? inr(r.credit) : ""}</td>
        <td className="space-y-1 pl-4">{r.status === "unmatched" ? <>
          {r.cands.map((c: any) => <button key={c.id} disabled={pending} onClick={() => go(() => matchLine(r.id, c.id))} className="block text-left text-brand-700 underline">Match {c.method} {c.source.replace("_", " ")} · {c.occurred_on}</button>)}
          <button disabled={pending} onClick={() => { const n = prompt("Reason this line has no sale or expense (e.g. bank charge)?"); if (n?.trim()) go(() => setLine(r.id, "other", n)); }} className="block underline">Reconcile as other</button>
          <button disabled={pending} onClick={() => go(() => setLine(r.id, "ignored"))} className="block text-slate-500 underline">Ignore</button></>
          : <button disabled={pending} onClick={() => go(() => setLine(r.id, "unmatched"))} className="underline">Undo</button>}</td></tr>)}
    </tbody></table></div></>);
}
