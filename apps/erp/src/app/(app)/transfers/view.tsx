"use client";
import { useState } from "react";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";
import { useRouter } from "next/navigation";
import { requestTransfer, approveTransfer, receiveTransfer, closeTransfer } from "./actions";
export function TransfersView({ transfers, branches, products }: { transfers: any[]; branches: any[]; products: any[]; me: string }) {
  const router = useRouter(); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ from: "", to: "", product: "", qty: "1", note: "" });
  const bn = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  async function run(fn: () => Promise<{ error?: string; ok?: string }>) { setBusy(true); const r = await fn(); setBusy(false); setMsg(r.error ?? r.ok ?? ""); router.refresh(); }
  return (<div className="space-y-6"><h1 className="font-display text-3xl font-semibold">Branch stock transfers</h1>
    <ModuleKpiGrid items={[{label:"Transfer records",value:transfers.length,detail:"Visible in current branch scope",icon:KPIIcons.package},{label:"Requested",value:transfers.filter((t:any)=>t.status==="requested").length,detail:"Awaiting processing",tone:"warning",icon:KPIIcons.clock},{label:"In transit",value:transfers.filter((t:any)=>t.status==="in_transit").length,detail:"Stock movement underway",tone:"info",icon:KPIIcons.trend},{label:"Completed",value:transfers.filter((t:any)=>t.status==="completed").length,detail:"Received/closed transfers",tone:"success",icon:KPIIcons.check}]} />
    {msg && <p className="rounded bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
    <div className="card grid gap-2 p-4 sm:grid-cols-5">
      <select className="field" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}><option value="">From branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select className="field" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">To branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <select className="field" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}><option value="">Product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}</select>
      <input className="field" type="number" min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
      <button disabled={busy || !f.from || !f.to || !f.product} className="btn btn-primary" onClick={() => run(() => requestTransfer(f.from, f.to, f.product, Number(f.qty), f.note))}>Request</button></div>
    <div className="card divide-y">{transfers.length === 0 && <p className="p-4 text-sm text-slate-500">No transfers yet.</p>}
      {transfers.map((t) => (<div key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
        <span className="flex-1">{t.products?.model} × {t.qty} · {bn(t.from_branch)} → {bn(t.to_branch)}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 capitalize">{t.status.replace("_", " ")}</span>
        {t.status === "requested" && <button disabled={busy} className="btn btn-primary !py-1" onClick={() => run(() => approveTransfer(t.id))}>Approve & dispatch</button>}
        {t.status === "in_transit" && <button disabled={busy} className="btn btn-primary !py-1" onClick={() => run(() => receiveTransfer(t.id))}>Mark received</button>}
        {["requested", "in_transit"].includes(t.status) && <button disabled={busy} className="btn btn-ghost !py-1" onClick={() => run(() => closeTransfer(t.id))}>{t.status === "requested" ? "Reject" : "Cancel"}</button>}
      </div>))}</div></div>);
}
