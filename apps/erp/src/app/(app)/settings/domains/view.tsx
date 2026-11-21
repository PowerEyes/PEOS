"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDomain, removeDomain } from "./actions";
export function DomainsView({ domains }: { domains: { domain: string; created_at: string }[] }) {
  const router = useRouter(); const [d, setD] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ error?: string; ok?: string }>) { setBusy(true); const r = await fn(); setBusy(false); setMsg(r.error ?? r.ok ?? ""); if (!r.error) { setD(""); router.refresh(); } }
  return (<div className="max-w-2xl space-y-4"><h1 className="font-display text-3xl font-semibold">Store domains</h1>
    <p className="text-sm text-slate-500">The customer website serves this organisation when visited on any domain listed here (orders, accounts and payments are filed under it).</p>
    {msg && <p className="rounded bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
    <div className="card flex gap-2 p-4"><input className="field flex-1" placeholder="shop.example.com" value={d} onChange={(e) => setD(e.target.value)} />
      <button className="btn btn-primary" disabled={busy || !d.trim()} onClick={() => run(() => addDomain(d))}>Add domain</button></div>
    <div className="card divide-y">{domains.length === 0 && <p className="p-4 text-sm text-slate-500">No domains yet. Until one is added the storefront uses the default organisation.</p>}
      {domains.map((x) => (<div key={x.domain} className="flex items-center justify-between p-3 text-sm"><span className="font-medium">{x.domain}</span>
        <button className="text-rose-600 underline" disabled={busy} onClick={() => { if (confirm(`Remove ${x.domain}?`)) run(() => removeDomain(x.domain)); }}>Remove</button></div>))}</div></div>);
}
