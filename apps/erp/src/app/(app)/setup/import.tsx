"use client";
import { useState, useTransition } from "react";
import { getSampleCatalogueCsv, importProducts } from "./actions";
export function ProductImport() {
  const [csv, setCsv] = useState(""), [msg, setMsg] = useState<{ e?: string; ok?: string }>({}), [pending, start] = useTransition();
  const run = () => start(async () => { const r = await importProducts(csv); setMsg({ e: r.error, ok: r.ok }); if (r.ok) setCsv(""); });
  const sample = async (download: boolean) => { const r = await getSampleCatalogueCsv(); if (!r.csv) { setMsg({ e: r.error || "Sample catalogue unavailable." }); return; } setCsv(r.csv); if (download) { const u = URL.createObjectURL(new Blob([r.csv], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download = "poweros-sample-catalogue.csv"; a.click(); URL.revokeObjectURL(u); } };
  return (<div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void sample(true)} className="btn btn-ghost text-xs">Download sample catalogue</button>
      <label className="btn btn-ghost cursor-pointer text-xs">Choose CSV file<input type="file" accept=".csv,text/csv" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); e.target.value = ""; }} /></label>
      <button type="button" onClick={() => void sample(false)} className="btn btn-ghost text-xs">Load sample rows</button>
    </div>
    <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={5} placeholder="Paste CSV here…" className="field w-full font-mono text-xs" />
    {msg.e && <p className="whitespace-pre-line rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{msg.e}</p>}
    {msg.ok && <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg.ok}</p>}
    <button disabled={pending || !csv.trim()} onClick={run} className="btn btn-primary text-sm">{pending ? "Importing…" : "Import products"}</button>
  </div>);
}
