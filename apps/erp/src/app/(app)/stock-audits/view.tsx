"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveStockAudit, saveCountLine, startStockAudit, submitStockAudit } from "./actions";

type Product = { id: string; model: string; sku: string | null; barcode: string | null; brands?: { name: string } | null };
export function StockAuditsView({ sessions, branches, products, stock, scope, currentUser }: { sessions: any[]; branches: any[]; products: Product[]; stock: any[]; scope: string | null; currentUser: string }) {
  const router = useRouter(); const [pending, run] = useTransition();
  const [branch, setBranch] = useState(scope ?? branches[0]?.id ?? ""), [title, setTitle] = useState(""), [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]), [values, setValues] = useState<Record<string,string>>({}), [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const available = useMemo(() => products.filter(p => `${p.brands?.name ?? ""} ${p.model} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  function start() { setMessage(""); run(async () => { const r = await startStockAudit({ branch_id: branch, title, product_ids: selected }); if (r.error) setMessage(r.error); else { setTitle(""); setSelected([]); router.refresh(); } }); }
  function save(lineId: string) { const value = Number(values[lineId]); setMessage(""); run(async () => { const r = await saveCountLine(lineId, value); if (r.error) setMessage(r.error); else router.refresh(); }); }
  function submit(id: string) { setMessage(""); run(async () => { const r = await submitStockAudit(id); if (r.error) setMessage(r.error); else router.refresh(); }); }
  function approve(id: string) { setMessage(""); run(async () => { const r = await approveStockAudit(id); if (r.error) setMessage(r.error); else router.refresh(); }); }
  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "Branch";
  return <div className="mx-auto max-w-6xl space-y-5">
    <header><h1 className="font-display text-3xl font-semibold">Stock cycle counts</h1><p className="text-sm text-slate-500">Compare a physical count with the system snapshot. An authorised manager approves and posts the variance.</p></header>
    {message && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</div>}
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">Start a count</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]"><label className="space-y-1 text-xs">Branch<select className="field" value={branch} onChange={e => setBranch(e.target.value)}>{branches.filter(b => !scope || b.id === scope).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="space-y-1 text-xs">Count title<input className="field" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Full shop, shelf A, brand…" /></label></div>
      <label className="block space-y-1 text-xs">Find products by name, SKU or barcode<input className="field" value={query} onChange={e => setQuery(e.target.value)} placeholder="Scan barcode or type to search" /></label>
      <div className="max-h-48 divide-y overflow-y-auto rounded-lg border">{available.slice(0,40).map(p => <label key={p.id} className="flex items-center gap-2 p-2 text-sm"><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(s => e.target.checked ? [...s,p.id] : s.filter(x => x !== p.id))}/><span className="flex-1">{p.brands?.name} {p.model}</span><code className="text-xs text-slate-500">{p.barcode || p.sku}</code><span className="text-xs text-slate-400">system {stock.find(s => s.product_id === p.id && s.branch_id === branch)?.qty ?? 0}</span></label>)}</div>
      <button disabled={pending || !branch || !title.trim() || !selected.length} onClick={start} className="btn btn-primary">{pending ? "Starting…" : `Start count (${selected.length} products)`}</button>
    </section>
    <section className="space-y-3"><h2 className="font-semibold">Recent counts</h2>{!sessions.length && <div className="card p-8 text-center text-sm text-slate-500">No cycle counts yet.</div>}
      {sessions.map((s:any) => { const lines = s.stock_audit_lines ?? []; return <article key={s.id} className="card overflow-hidden">
        <button className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left" onClick={() => setExpanded(expanded === s.id ? null : s.id)}><span><b>{s.title}</b><span className="ml-2 text-sm text-slate-500">{branchName(s.branch_id)} · {lines.length} products</span><small className="block text-slate-400">{new Date(s.created_at).toLocaleString()}</small></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{s.status}</span></button>
        {expanded === s.id && <div className="space-y-3 border-t p-4"><div className="divide-y">{lines.map((l:any) => { const diff = l.counted_qty == null ? null : Number(l.counted_qty)-Number(l.expected_qty); return <div key={l.id} className="grid grid-cols-[1fr_70px_90px_80px] items-center gap-2 py-2 text-sm"><span className="min-w-0"><b className="block truncate">{l.products?.brands?.name} {l.products?.model}</b><small className="text-slate-400">{l.products?.barcode || l.products?.sku || ""}</small></span><span>book {l.expected_qty}</span>{s.status === "counting" ? <input type="number" min="0" step="1" inputMode="numeric" className="field py-1 text-right" value={values[l.id] ?? l.counted_qty ?? ""} onChange={e => setValues(v => ({...v,[l.id]:e.target.value}))} onBlur={() => { const raw = values[l.id]; if (raw !== undefined && raw.trim() && raw !== String(l.counted_qty ?? "")) save(l.id); }} placeholder="Count"/> : <span>count {l.counted_qty ?? "—"}</span>}<b className={diff == null ? "text-slate-400" : diff ? "text-amber-700" : "text-emerald-700"}>{diff == null ? "—" : diff > 0 ? `+${diff}` : diff}</b></div>; })}</div>
          <div className="flex flex-wrap justify-end gap-2">{s.status === "counting" && s.started_by === currentUser && <button disabled={pending} className="btn btn-primary" onClick={() => submit(s.id)}>Submit for manager approval</button>}{s.status === "submitted" && <button disabled={pending || s.started_by === currentUser} className="btn btn-gold" onClick={() => approve(s.id)}>Approve and post adjustments</button>}</div>
          {s.status === "approved" && <p className="text-right text-xs text-emerald-700">Approved {s.approved_at ? new Date(s.approved_at).toLocaleString() : ""}; this count is locked.</p>}
        </div>}</article>; })}
    </section>
  </div>;
}
