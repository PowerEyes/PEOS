"use client";
import { useState } from "react";
export function AccountantExportView({ branches, allowAll }: { branches: {id:string;name:string}[]; allowAll:boolean }) {
  const now = new Date(), previous = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const [month,setMonth] = useState(`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,"0")}`), [branch,setBranch] = useState(allowAll ? "all" : branches[0]?.id ?? ""), [busy,setBusy] = useState(false), [error,setError] = useState("");
  async function download() { setBusy(true); setError(""); try { const q=new URLSearchParams({month,branch}); const res=await fetch(`/api/accountant-export?${q}`,{cache:"no-store"}); if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||"Export failed.");} const blob=await res.blob(), url=URL.createObjectURL(blob), a=document.createElement("a");a.href=url;a.download=`poweros-accountant-${month}.zip`;a.click();URL.revokeObjectURL(url); } catch(e:any){setError(e.message||"Export failed.");} finally{setBusy(false);} }
  return <div className="mx-auto max-w-3xl space-y-5"><header><h1 className="font-display text-3xl font-semibold">Accountant export</h1><p className="text-sm text-slate-500">Download a month of PowerOS finance records as a ZIP of separate CSV files.</p></header>
    <div className="card space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-xs">Month<input type="month" className="field" value={month} onChange={e=>setMonth(e.target.value)}/></label><label className="space-y-1 text-xs">Branch<select className="field" value={branch} onChange={e=>setBranch(e.target.value)}>{allowAll&&<option value="all">All accessible branches</option>}{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label></div>
      <p className="text-xs text-slate-500">Includes sales, purchases, GSTR-1 outward invoice detail, GST input credit detail, cashbook and expenses. Export contents depend on records and access available for the selected branch.</p>
      {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<button disabled={busy||!month||(!allowAll&&!branches.length)} onClick={download} className="btn btn-primary">{busy?"Preparing export…":"Download CSV bundle"}</button></div>
  </div>;
}
