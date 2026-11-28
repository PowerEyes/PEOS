"use client";
import { useState, useTransition } from "react";
import { setLeadStatus } from "../actions";
export function LeadRow({ lead }: { lead: any }) {
  const [note, setNote] = useState(lead.note ?? ""); const [msg, setMsg] = useState(""); const [pending, start] = useTransition();
  const go = (st: any) => start(async () => { const r = await setLeadStatus(lead.id, st, note); setMsg(r.error ?? r.ok ?? ""); });
  return (<li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
    <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{lead.business_name} <span className="font-normal text-slate-400">· {lead.full_name}</span></p><p className="text-xs text-slate-500">{new Date(lead.created_at).toLocaleString("en-IN")}</p></div>
    <p className="text-slate-300"><a className="underline" href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone ? ` · ${lead.phone}` : ""}{lead.branches ? ` · ${lead.branches} branch(es)` : ""}{lead.plan_code ? ` · interested in ${lead.plan_code}` : ""}</p>
    {lead.message && <p className="mt-1 whitespace-pre-wrap text-slate-400">{lead.message}</p>}
    <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Internal note" className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
    <div className="mt-2 flex flex-wrap items-center gap-2">{(["contacted", "converted", "rejected", "new"] as const).filter(x => x !== lead.status).map(x => <button key={x} disabled={pending} onClick={() => go(x)} className="rounded border border-slate-700 px-2 py-1 capitalize hover:bg-slate-800">Mark {x}</button>)}{msg && <span className="text-xs text-slate-400">{msg}</span>}</div></li>);
}
