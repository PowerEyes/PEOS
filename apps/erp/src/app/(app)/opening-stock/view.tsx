"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { postOpeningStock } from "./actions";

type Branch = { id: string; name: string };
type Product = { id: string; model: string; sku: string | null; barcode: string | null; brands?: { name: string } | null; stock?: { branch_id: string; qty: number }[] | null };

export function OpeningStockView({ branches, products, scope, canAdjust }: {
  branches: Branch[]; products: Product[]; scope: string | null; canAdjust: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [branch, setBranch] = useState(scope ?? branches[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const bn = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const qtyAt = (p: Product) => p.stock?.find((s) => s.branch_id === branch)?.qty ?? 0;

  // Default view: products with no stock yet at this branch — that's the whole
  // point of the screen. Toggle to include everything (read-only for stocked rows).
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyEmpty && qtyAt(p) > 0) return false;
      if (!q) return true;
      return `${p.brands?.name ?? ""} ${p.model} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(q);
    });
    // qtyAt depends on branch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, onlyEmpty, branch]);

  const filled = Object.entries(qty).filter(([, v]) => Number(v) > 0);
  const total = filled.reduce((s, [, v]) => s + Number(v), 0);

  function post() {
    if (!branch) return setMsg({ text: "Choose a branch.", bad: true });
    const rowsToPost = filled.map(([product_id, v]) => ({ product_id, qty: Number(v) }));
    if (!rowsToPost.length) return setMsg({ text: "Enter a quantity for at least one product.", bad: true });
    const bad = rowsToPost.find((r) => !Number.isInteger(r.qty) || r.qty < 0);
    if (bad) return setMsg({ text: "Quantities must be whole numbers of 0 or more.", bad: true });
    setMsg(null);
    start(async () => {
      const r = await postOpeningStock({ branch_id: branch, rows: rowsToPost });
      if (r.error) return setMsg({ text: r.error, bad: true });
      setMsg({ text: r.ok ?? "Posted." });
      setQty({});
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-semibold">Opening stock</h1>
        <p className="text-sm text-slate-500">Load starting quantities for a branch in one pass — for go-live or a new outlet. Only products with no stock at this branch can take opening stock.</p>
      </header>

      {msg && <div role="alert" className={`rounded-lg p-3 text-sm ${msg.bad ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.text}</div>}

      {!canAdjust ? (
        <section className="card p-4 text-sm text-slate-500">
          You don&rsquo;t have the <b>Adjust stock manually</b> permission — ask an owner or admin (Staff &rarr; Permissions) to grant it.
        </section>
      ) : (
        <>
          <section className="card space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="block text-xs font-medium text-slate-600">Branch
                <select className="field mt-1" value={branch} onChange={(e) => { setBranch(e.target.value); setQty({}); }}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">Find product
                <span className="relative mt-1 block">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input className="field pl-9" placeholder="Brand, model, SKU, barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-slate-600">
                <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
                Only products without stock
              </label>
            </div>
            <p className="text-xs text-slate-400">Showing {rows.length} of {products.length} products{branch ? ` · empty at ${bn(branch)}` : ""}.</p>
          </section>

          <section className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr><th className="p-3">Product</th><th className="p-3">SKU / barcode</th><th className="p-3 text-right">Current qty</th><th className="p-3 w-44">Opening qty</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const has = qtyAt(p) > 0;
                  return (
                    <tr key={p.id} className={`border-t ${has ? "bg-slate-50/60" : ""}`}>
                      <td className="p-3"><b>{p.brands?.name} {p.model}</b></td>
                      <td className="p-3 font-mono text-xs text-slate-500">{p.barcode || p.sku || "—"}</td>
                      <td className={`p-3 text-right ${has ? "text-slate-500" : "text-slate-400"}`}>{qtyAt(p)}</td>
                      <td className="p-3">
                        {has
                          ? <span className="text-xs text-slate-400">already has stock</span>
                          : <input type="number" min={0} step="1" inputMode="numeric" className="field py-1.5 text-right"
                              aria-label={`Opening qty for ${p.brands?.name ?? ""} ${p.model}`}
                              value={qty[p.id] ?? ""} onChange={(e) => setQty((x) => ({ ...x, [p.id]: e.target.value }))} placeholder="—" />}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">No products match.</td></tr>}
              </tbody>
            </table>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={pending || !filled.length} onClick={post}>
              {pending ? "Posting…" : `Post opening stock (${filled.length} product${filled.length === 1 ? "" : "s"})`}
            </button>
            {filled.length > 0 && <span className="text-sm text-slate-500">{total} unit{total === 1 ? "" : "s"} total to {bn(branch)}</span>}
            <span className="text-xs text-slate-400">Posted as movement reason &ldquo;opening&rdquo; — auditable and reversible.</span>
          </div>
        </>
      )}
    </div>
  );
}
