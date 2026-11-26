"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLoyaltyRules } from "./actions";
type V = { earn_rate: number; redeem_rate: number; min_redeem: number; max_redeem_pct: number };
const L: [keyof V, string, string][] = [["earn_rate", "Points earned per ₹100 spent", "e.g. 5"], ["redeem_rate", "Rupee value of 1 point", "e.g. 1"], ["min_redeem", "Minimum points to redeem", "e.g. 100"], ["max_redeem_pct", "Max % of a bill payable with points", "e.g. 20"]];
export function LoyaltyRules({ initial, canEdit }: { initial: V; canEdit: boolean }) {
  const [v, setV] = useState(initial), [m, setM] = useState<{ e?: string; ok?: string }>({}), [p, start] = useTransition(), r = useRouter();
  return (<div className="card space-y-3 p-4"><h2 className="text-sm font-semibold">Earning & redemption rules</h2>
    <div className="grid gap-3 sm:grid-cols-2">{L.map(([k, label, ph]) => <label key={k} className="text-xs font-medium text-slate-600">{label}<input type="number" step="any" min={0} disabled={!canEdit} placeholder={ph} value={Number.isNaN(v[k]) ? "" : v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value === "" ? NaN : Number(e.target.value) })} className="field mt-1 w-full" /></label>)}</div>
    {m.e && <p className="text-sm text-rose-600">{m.e}</p>}{m.ok && <p className="text-sm text-emerald-700">{m.ok}</p>}
    {canEdit ? <button disabled={p} className="btn btn-primary text-sm" onClick={() => start(async () => { const x = await saveLoyaltyRules(v); setM({ e: x.error, ok: x.ok }); if (!x.error) r.refresh(); })}>{p ? "Saving…" : "Save rules"}</button> : <p className="text-xs text-slate-500">Only managers and admins can change these rules.</p>}</div>);
}
