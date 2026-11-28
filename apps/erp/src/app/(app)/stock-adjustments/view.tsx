"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { adjustStock } from "@/app/(app)/inventory/actions";

type Branch = { id: string; name: string };
type Product = { id: string; model: string; sku: string | null; barcode: string | null; brands?: { name: string } | null; stock?: { branch_id: string; qty: number }[] | null };
type Move = { id: string; branch_id: string; product_id: string; delta: number; reason: string; note: string | null; created_by: string | null; created_at: string; products?: { model: string; sku: string | null; brands?: { name: string } | null } | null };
type Profile = { id: string; full_name: string | null };

const REASONS = ["adjustment", "damage", "return", "purchase", "opening", "audit"] as const;
const ALL_REASONS = ["opening", "purchase", "sale", "return", "adjustment", "damage", "transfer_in", "transfer_out", "audit"] as const;
const MANUAL = new Set<string>(REASONS);

// Deterministic on server and client — toLocaleString() differs by locale/timezone
// and causes React hydration mismatches during SSR.
const stamp = (s: string) => (s ? `${s.slice(0, 10)} ${s.slice(11, 16)} UTC` : "—");

export function StockAdjustmentsView({ branches, products, moves, profiles, scope, canAdjust, me }: {
  branches: Branch[]; products: Product[]; moves: Move[]; profiles: Profile[];
  scope: string | null; canAdjust: boolean; me: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  // New-adjustment form state
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [branch, setBranch] = useState(scope ?? branches[0]?.id ?? "");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("adjustment");
  const [note, setNote] = useState("");

  // History filters
  const [fq, setFq] = useState("");
  const [fReason, setFReason] = useState("");
  const [showAll, setShowAll] = useState(false);

  const bn = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const who = (id: string | null) => (id === me ? "You" : profiles.find((p) => p.id === id)?.full_name ?? "—");
  const qtyAt = (p: Product, b: string) => p.stock?.find((s) => s.branch_id === b)?.qty ?? 0;

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) =>
      `${p.brands?.name ?? ""} ${p.model} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [products, query]);

  const history = useMemo(() => {
    const q = fq.trim().toLowerCase();
    return moves.filter((m) => {
      if (!showAll && !MANUAL.has(m.reason)) return false;
      if (fReason && m.reason !== fReason) return false;
      if (!q) return true;
      return `${m.products?.brands?.name ?? ""} ${m.products?.model ?? ""} ${m.products?.sku ?? ""} ${m.note ?? ""}`.toLowerCase().includes(q);
    });
  }, [moves, fq, fReason, showAll]);

  function submit() {
    if (!picked) return setMsg({ text: "Pick a product first.", bad: true });
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) return setMsg({ text: "Enter a whole number other than zero, e.g. 5 or -3.", bad: true });
    if (!branch) return setMsg({ text: "Choose a branch.", bad: true });
    // Guard rails that would otherwise only surface after the round trip.
    if (n < 0 && qtyAt(picked, branch) + n < 0) return setMsg({ text: `Only ${qtyAt(picked, branch)} in stock at ${bn(branch)} — cannot remove ${Math.abs(n)}.`, bad: true });
    setMsg(null);
    start(async () => {
      const r = await adjustStock({ product_id: picked!.id, branch_id: branch, delta: n, reason, note: note.trim() || undefined });
      if (r.error) return setMsg({ text: r.error, bad: true });
      setMsg({ text: `${n > 0 ? "+" : ""}${n} ${picked!.model} → ${bn(branch)}. ${r.ok ?? ""}` });
      setDelta(""); setNote(""); setPicked(null); setQuery("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-semibold">Stock adjustments</h1>
        <p className="text-sm text-slate-500">Correct quantities by hand and see every manual change. Purchases, sales and transfers post their own movements.</p>
      </header>

      {msg && <div role="alert" className={`rounded-lg p-3 text-sm ${msg.bad ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.text}</div>}

      {canAdjust ? (
        <section className="card space-y-4 p-4">
          <h2 className="font-semibold">New adjustment</h2>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">Product</label>
            {picked ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="flex-1"><b>{picked.brands?.name} {picked.model}</b>
                  <span className="ml-2 font-mono text-xs text-slate-500">{picked.barcode || picked.sku}</span>
                  <span className="ml-2 text-xs text-slate-500">stock {qtyAt(picked, branch)} at {bn(branch)}</span>
                </span>
                <button type="button" aria-label="Clear product" className="rounded p-1 text-slate-400 hover:bg-slate-200" onClick={() => { setPicked(null); setQuery(""); }}><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input className="field pl-9" placeholder="Search by brand, model, SKU or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
                {hits.length > 0 && (
                  <ul className="mt-1 max-h-56 divide-y overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {hits.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => { setPicked(p); setQuery(""); if (!branch) setBranch(branches[0]?.id ?? ""); }}>
                          <span className="flex-1">{p.brands?.name} {p.model}</span>
                          <span className="font-mono text-xs text-slate-500">{p.barcode || p.sku}</span>
                          <span className="w-24 text-right text-xs text-slate-400">{branch ? `${qtyAt(p, branch)} here` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-slate-600">Branch
              <select className="field mt-1" value={branch} onChange={(e) => setBranch(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Change (+/-)
              <input type="number" step="1" className="field mt-1" placeholder="e.g. 5 or -3" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">Reason
              <select className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
                {REASONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Note (optional)
              <input className="field mt-1" maxLength={200} placeholder="e.g. damaged in transit" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" disabled={pending || !picked} onClick={submit}>{pending ? "Applying…" : "Apply adjustment"}</button>
            <span className="text-xs text-slate-400">Whole numbers only, ±10,000 max. Stock can never go negative.</span>
          </div>
        </section>
      ) : (
        <section className="card p-4 text-sm text-slate-500">
          You don&rsquo;t have the <b>Adjust stock manually</b> permission — ask an owner or admin (Staff &rarr; Permissions) to grant it. You can still read the history below.
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Recent {showAll ? "stock" : "manual"} movements</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field w-48" placeholder="Filter by product or note" value={fq} onChange={(e) => setFq(e.target.value)} />
            <select className="field w-40" value={fReason} onChange={(e) => { const v = e.target.value; setFReason(v); if (v && !MANUAL.has(v)) setShowAll(true); }}>
              <option value="">All reasons</option>
              {ALL_REASONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
            <label className="flex cursor-pointer items-center gap-2 pb-1 text-xs text-slate-500" title="Include sales, purchases, transfers and audit counts">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Include system movements
            </label>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="p-3">When</th><th className="p-3">Product</th><th className="p-3">Branch</th><th className="p-3 text-right">Change</th><th className="p-3">Reason</th><th className="p-3">Note</th><th className="p-3">By</th></tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="whitespace-nowrap p-3 text-xs text-slate-500">{stamp(m.created_at)}</td>
                  <td className="p-3"><b>{m.products?.brands?.name} {m.products?.model}</b><span className="block font-mono text-xs text-slate-400">{m.products?.sku || ""}</span></td>
                  <td className="p-3">{bn(m.branch_id)}</td>
                  <td className={`p-3 text-right font-semibold ${m.delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="p-3 capitalize">{m.reason.replace("_", " ")}</td>
                  <td className="max-w-[16rem] truncate p-3 text-xs text-slate-500" title={m.note ?? ""}>{m.note ?? "—"}</td>
                  <td className="p-3 text-xs text-slate-500">{who(m.created_by)}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-400">No {showAll ? "stock" : "manual"} movements match.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Showing {history.length} of the last {moves.length} movements{scope ? ` for ${bn(scope)}` : " across all branches"}. {showAll ? "Includes sales, purchases, transfers and cycle counts." : "Toggle “Include system movements” for the full trail."}</p>
      </section>
    </div>
  );
}
