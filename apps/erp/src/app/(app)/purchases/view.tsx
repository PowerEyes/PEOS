"use client";
import { useMemo, useState } from "react";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { Plus, Search, ClipboardList, CheckCircle2, XCircle, PackageCheck, ChevronDown, Truck, Trash2 } from "lucide-react";
import { createPO, approvePO, cancelPO, receivePO } from "./actions";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const TAX_RATES = [0, 5, 12, 18, 28];
const HSN = { frame: "900319", sunglass: "900411", contact_lens: "900161", accessory: "900319" } as Record<string, string>;

const STATUS_TONE: Record<string, "grey" | "blue" | "gold" | "green" | "red"> = {
  draft: "grey", approved: "blue", partially_received: "gold", received: "green", cancelled: "red",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", approved: "Approved", partially_received: "Part received", received: "Received", cancelled: "Cancelled",
};

const L = ({ t, req, children }: { t: string; req?: boolean; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{t}{req && <span className="ml-0.5 text-rose-500">*</span>}</span>{children}</label>;

type Row = { product_id: string; qty: string; rate: string; tax_pct: string; description: string; hsn: string };
const EMPTY_ROW: Row = { product_id: "", qty: "1", rate: "", tax_pct: "18", description: "", hsn: "" };

/* ── Product picker ────────────────────────────────────────────────────────── */
function ProductPicker({ products, onPick }: { products: any[]; onPick: (p: any) => void }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    return products.filter((p) => `${p.sku ?? ""} ${p.model} ${p.brands?.name ?? ""}`.toLowerCase().includes(s)).slice(0, 8);
  }, [q, products]);
  return (
    <div className="relative">
      <input data-testid="po-product-search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search SKU or product name *" className="field py-2 text-sm" />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onPick(p); setQ(""); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span className="truncate"><span className="font-mono text-xs font-semibold text-navy-700">{p.sku}</span> {p.brands?.name} {p.model}</span>
                <span className="shrink-0 text-slate-500">{inr(p.cost_price ?? p.selling_price)}</span>
              </button>
            </li>))}
          {!list.length && <li className="px-3 py-2 text-sm text-slate-400">No product matches that search.</li>}
        </ul>)}
    </div>);
}

/* ── New / edit PO drawer ─────────────────────────────────────────────────── */
function PODrawer({ suppliers, branches, products, onClose }: { suppliers: any[]; branches: any[]; products: any[]; onClose: () => void }) {
  const router = useRouter(); const toast = useToast();
  const [f, setF] = useState({
    branch_id: branches[0]?.id ?? "", supplier_search: "", supplier_id: "" as string,
    supplier_gstin: "", order_date: new Date().toISOString().slice(0, 10),
    expected_date: "", supply_type: "intrastate", notes: "",
  });
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const num = (v: string) => Number(v) || 0;
  const lineTotal = (r: Row) => num(r.qty) * num(r.rate);
  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const r of rows) { const t = lineTotal(r); sub += t; tax += t * num(r.tax_pct) / 100; }
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      subtotal: round(sub),
      cgst: f.supply_type === "interstate" ? 0 : round(tax / 2),
      sgst: f.supply_type === "interstate" ? 0 : round(tax / 2),
      igst: f.supply_type === "interstate" ? round(tax) : 0,
      grand: round(sub + tax),
    };
  }, [rows, f.supply_type]);

  function pickSupplier(name: string) {
    const hit = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setF((v) => ({ ...v, supplier_search: name, supplier_id: hit?.id ?? "", supplier_gstin: hit?.gstin ?? v.supplier_gstin }));
  }
  function setRow(i: number, k: keyof Row, v: string) { setRows((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r))); }
  function pickProduct(i: number, p: any) {
    setRows((rs) => rs.map((r, n) => n === i ? {
      ...r, product_id: p.id,
      description: `${p.brands?.name ? p.brands.name + " " : ""}${p.model}`.trim(),
      hsn: p.hsn ?? HSN[p.kind] ?? "900319",
      rate: String(p.cost_price ?? p.selling_price),
      tax_pct: String(p.tax_pct ?? 18),
    } : r));
  }

  async function save() {
    setErr(""); setBusy(true);
    const lines = rows.filter((r) => r.product_id);
    if (!lines.length) { setBusy(false); return setErr("Add at least one product line."); }
    if (!f.supplier_search.trim()) { setBusy(false); return setErr("Choose the supplier."); }
    if (!f.branch_id) { setBusy(false); return setErr("Choose the branch."); }
    const r = await createPO({
      branch_id: f.branch_id,
      supplier_id: f.supplier_id || null,
      supplier_name: f.supplier_search.trim(),
      supplier_gstin: f.supplier_gstin,
      order_date: f.order_date,
      expected_date: f.expected_date || null,
      supply_type: f.supply_type,
      notes: f.notes,
      lines: lines.map((l) => ({
        product_id: l.product_id, qty: num(l.qty), rate: num(l.rate), tax_pct: num(l.tax_pct),
        hsn: l.hsn || null, description: l.description || null,
      })),
    }).catch((e: any) => ({ error: e?.message || "Something went wrong. Please try again." }));
    setBusy(false);
    if (!("ok" in r)) return setErr(r.error);
    toast(r.ok!); router.refresh(); onClose();
  }

  const supNames = suppliers.map((s) => s.name);
  return (
    <Drawer open onClose={onClose} title="New purchase order" subtitle="Draft → approve → goods receipt"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            {linesCount(rows)} product{linesCount(rows) === 1 ? "" : "s"} · <b className="text-navy-900">{inr(totals.grand)}</b>
            <span className="ml-2 text-xs">CGST {inr(totals.cgst)} · SGST {inr(totals.sgst)}{totals.igst ? ` · IGST ${inr(totals.igst)}` : ""}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button data-testid="po-save" onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Create PO"}</button>
          </div>
        </div>}>
      <div className="space-y-4 p-5">
        {err && <p data-testid="po-error" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="Branch (goods go here)" req>
            <select data-testid="po-branch" value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value })} className="field">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></L>
          <L t="Order date" req><input data-testid="po-date" type="date" value={f.order_date} onChange={(e) => setF({ ...f, order_date: e.target.value })} className="field" /></L>
          <L t="Supplier" req>
            <input data-testid="po-supplier" list="po-suppliers" value={f.supplier_search}
              onChange={(e) => pickSupplier(e.target.value)} placeholder="Search or type supplier name *" className="field" />
            <datalist id="po-suppliers">{supNames.map((n) => <option key={n} value={n} />)}</datalist>
          </L>
          <L t="Supplier GSTIN"><input data-testid="po-gstin" value={f.supplier_gstin} onChange={(e) => setF({ ...f, supplier_gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="33ABCDE1234F1Z5" className="field font-mono text-sm" /></L>
          <L t="Expected delivery"><input data-testid="po-expected" type="date" value={f.expected_date} onChange={(e) => setF({ ...f, expected_date: e.target.value })} className="field" /></L>
          <L t="Supply type">
            <select data-testid="po-supply" value={f.supply_type} onChange={(e) => setF({ ...f, supply_type: e.target.value })} className="field">
              <option value="intrastate">Intrastate (CGST + SGST)</option><option value="interstate">Interstate (IGST)</option>
            </select></L>
        </div>

        <div className="rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</p>
            <button type="button" onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])} className="btn btn-ghost !py-1 text-xs"><Plus size={13} />Add line</button>
          </div>
          <div className="space-y-3 p-3">
            {rows.map((r, i) => (
              <div key={i} data-testid="po-line" className="grid gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-[2fr_repeat(3,60px)_auto]">
                <ProductPicker products={products} onPick={(p) => pickProduct(i, p)} />
                <input data-testid="po-qty" type="number" min={1} value={r.qty} onChange={(e) => setRow(i, "qty", e.target.value)} className="field py-2 text-sm" placeholder="Qty" />
                <input data-testid="po-rate" type="number" min={0} value={r.rate} onChange={(e) => setRow(i, "rate", e.target.value)} className="field py-2 text-sm" placeholder="Rate" />
                <select data-testid="po-tax" value={r.tax_pct} onChange={(e) => setRow(i, "tax_pct", e.target.value)} className="field py-2 text-sm">
                  {TAX_RATES.map((t) => <option key={t} value={t}>{t}%</option>)}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <span className="whitespace-nowrap text-sm font-semibold text-navy-900">{inr(lineTotal(r))}</span>
                  <button type="button" aria-label="Remove line" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, n) => n !== i) : rs))} className="rounded p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
                {r.description && <p className="col-span-full truncate text-xs text-slate-500">{r.description} {r.hsn && `· HSN ${r.hsn}`}</p>}
              </div>))}
          </div>
        </div>

        <L t="Notes"><textarea data-testid="po-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="field" placeholder="Optional notes for this order" /></L>
      </div>
    </Drawer>);
}
function linesCount(rows: Row[]) { return rows.filter((r) => r.product_id).length; }

/* ── Goods receipt modal (partial or full) ────────────────────────────────── */
function ReceiveModal({ po, onClose }: { po: any; onClose: () => void }) {
  const router = useRouter(); const toast = useToast();
  const lines: any[] = Array.isArray(po.lines) ? po.lines : [];
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.product_id, String(Math.max(0, (Number(l.qty) || 0) - (Number(l.received_qty) || 0)))])));
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const total = lines.reduce((a, l) => a + (Number(qtys[l.product_id]) || 0), 0);

  async function receive() {
    setErr(""); setBusy(true);
    const incoming = lines
      .map((l) => ({ product_id: l.product_id, qty: Number(qtys[l.product_id]) || 0 }))
      .filter((r) => r.qty > 0);
    if (!incoming.length) { setBusy(false); return setErr("Enter at least one quantity."); }
    const r = await receivePO(po.id, incoming, note).catch((e: any) => ({
      error: e?.message || "Something went wrong. Please try again.",
    }));
    setBusy(false);
    if (!("ok" in r)) return setErr(r.error);
    toast(r.ok!); router.refresh(); onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Receive goods — ${po.po_no}`} subtitle={`${po.supplier_name} · ${total} unit(s) entering stock`}>
      <div className="space-y-3 p-5">
        {err && <p data-testid="recv-error" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {lines.map((l) => {
            const ordered = Number(l.qty) || 0; const done = Number(l.received_qty) || 0; const left = ordered - done;
            return (
              <div key={l.product_id} data-testid="recv-line" className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900">{l.description}</p>
                  <p className="text-xs text-slate-500"><span className="font-mono">{l.sku ?? ""}</span> · ordered {ordered} · already received {done}</p>
                </div>
                <input data-testid="recv-qty" type="number" min={0} max={left} value={qtys[l.product_id] ?? ""}
                  onChange={(e) => setQtys((q) => ({ ...q, [l.product_id]: e.target.value }))}
                  disabled={left <= 0} className="field w-20 py-1.5 text-center text-sm" />
              </div>);
          })}
        </div>
        <L t="Delivery note / remarks"><input data-testid="recv-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. GRN-001, 2 boxes short" className="field" /></L>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn btn-ghost flex-1">Close</button>
          <button data-testid="recv-submit" onClick={receive} disabled={busy} className="btn btn-primary flex-1">{busy ? "Receiving…" : `Receive ${total} unit${total === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </Modal>);
}

/* ── Detail ───────────────────────────────────────────────────────────────── */
function Detail({ po, onClose, onApprove, onReceive, onCancel, busy, branchName }: {
  po: any; onClose: () => void; onApprove: () => void; onReceive: () => void; onCancel: () => void; busy: boolean; branchName: (id: string) => string;
}) {
  const lines: any[] = Array.isArray(po.lines) ? po.lines : [];
  const ordered = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const got = lines.reduce((a, l) => a + (Number(l.received_qty) || 0), 0);
  return (
    <Drawer open onClose={onClose} title={po.po_no} subtitle={`${po.supplier_name} · ${STATUS_LABEL[po.status] ?? po.status}`}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {(po.status === "draft" || po.status === "approved" || po.status === "partially_received") &&
            <button data-testid="po-cancel" onClick={onCancel} disabled={busy} className="btn btn-ghost gap-1 text-rose-600"><XCircle size={15} />Cancel PO</button>}
          {po.status === "draft" && <button data-testid="po-approve" onClick={onApprove} disabled={busy} className="btn btn-primary gap-1"><CheckCircle2 size={15} />Approve</button>}
          {(po.status === "approved" || po.status === "partially_received") &&
            <button data-testid="po-receive" onClick={onReceive} disabled={busy} className="btn btn-gold gap-1"><PackageCheck size={15} />Receive goods</button>}
        </div>}>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Ordered value", inr(po.grand_total)],
            ["Units ordered", String(ordered)],
            ["Units received", String(got)],
            ["Status", STATUS_LABEL[po.status] ?? po.status],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">{k}</p><p className="text-lg font-bold text-navy-900">{v}</p>
            </div>))}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-slate-600"><b className="text-navy-900">Branch:</b> {branchName(po.branch_id)}</p>
          <p className="text-slate-600"><b className="text-navy-900">Order date:</b> {po.order_date}</p>
          <p className="text-slate-600"><b className="text-navy-900">Expected:</b> {po.expected_date ?? "—"}</p>
          <p className="text-slate-600"><b className="text-navy-900">Supply:</b> {po.supply_type === "interstate" ? "Interstate (IGST)" : "Intrastate (CGST+SGST)"}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[1fr_60px_80px_90px] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            <span>Product</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Received</span>
          </div>
          <div className="divide-y divide-slate-100">
            {lines.map((l) => {
              const left = (Number(l.qty) || 0) - (Number(l.received_qty) || 0);
              return (
                <div key={l.product_id} data-testid="po-detail-line" className="grid grid-cols-[1fr_60px_80px_90px] items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium text-navy-900">{l.description}</span><span className="font-mono text-xs text-slate-400">{l.sku ?? ""}</span></span>
                  <span className="text-right">{l.qty}</span>
                  <span className="text-right">{inr(l.rate)}</span>
                  <span className="text-right">
                    <Pill tone={left <= 0 ? "green" : Number(l.received_qty) > 0 ? "gold" : "grey"}>{l.received_qty ?? 0}/{l.qty}</Pill>
                  </span>
                </div>);
            })}
          </div>
        </div>
        {po.notes && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{po.notes}</p>}
        {po.invoice_id && <p className="text-xs text-slate-400">Supplier liability booked as purchase invoice for {inr(po.grand_total)}.</p>}
      </div>
    </Drawer>);
}
/* ── Main ─────────────────────────────────────────────────────────────────── */
export function PurchasesView({ pos, suppliers, branches, products }: { pos: any[]; suppliers: any[]; branches: any[]; products: any[] }) {
  const router = useRouter(); const toast = useToast();
  const [q, setQ] = useState(""); const [status, setStatus] = useState("all"); const [branch, setBranch] = useState("all");
  const [drawer, setDrawer] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [recvPo, setRecvPo] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const rows = useMemo(() => pos.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (branch !== "all" && p.branch_id !== branch) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (p.po_no ?? "").toLowerCase().includes(s) || (p.supplier_name ?? "").toLowerCase().includes(s);
  }), [pos, status, branch, q]);

  const count = (s: string) => pos.filter((p) => p.status === s).length;
  const openValue = pos.filter((p) => ["draft", "approved", "partially_received"].includes(p.status)).reduce((a, p) => a + Number(p.grand_total), 0);
  const receivedValue = pos.filter((p) => p.status === "received").reduce((a, p) => a + Number(p.grand_total), 0);

  const detail = pos.find((p) => p.id === detailId) ?? null;

  async function run(id: string, fn: () => Promise<{ error?: string; ok?: string }>) {
    setBusy(id);
    let r: { error?: string; ok?: string };
    try {
      r = await fn();
    } catch (e: any) {
      // A rejected server action must not leave the row buttons wedged disabled.
      r = { error: e?.message || "Something went wrong. Please try again." };
    }
    setBusy(null);
    r.error ? toast(r.error, "err") : toast(r.ok!);
    router.refresh();
    if (!r.error) { setDetailId(null); setExpandedId(null); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Purchase Orders</h1>
          <p className="mt-0.5 text-slate-500">Order from suppliers, approve, then receive goods into branch stock</p>
        </div>
        <button data-testid="new-po" onClick={() => setDrawer(true)} className="btn btn-gold gap-2"><Plus size={16} />New purchase order</button>
      </div>

      <ModuleKpiGrid items={[{label:"Purchase orders",value:pos.length,detail:"Loaded purchase orders",icon:KPIIcons.package},{label:"Draft / awaiting approval",value:count("draft"),detail:"Approval queue",tone:count("draft")?"warning":"success",icon:KPIIcons.clock},{label:"Partially received",value:count("partially_received"),detail:"Receipts still outstanding",tone:count("partially_received")?"warning":"default",icon:KPIIcons.warning},{label:"Active suppliers",value:suppliers.length,detail:"Available supplier directory",icon:KPIIcons.users}]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Awaiting approval", val: String(count("draft")), icon: ClipboardList, cls: "bg-slate-100 text-slate-600" },
          { label: "Approved, awaiting goods", val: String(count("approved")), icon: Truck, cls: "bg-blue-50 text-blue-600" },
          { label: "Open order value", val: inr(openValue), icon: PackageCheck, cls: "bg-amber-50 text-gold-600" },
          { label: "Received into stock", val: inr(receivedValue), icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
        ].map((k) => (
          <div key={k.label} className="card flex items-center gap-4 p-5">
            <span className={`grid h-12 w-12 place-items-center rounded-xl ${k.cls}`}><k.icon size={22} /></span>
            <div><p className="text-sm text-slate-500">{k.label}</p><p className="text-2xl font-bold text-navy-900">{k.val}</p></div>
          </div>))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input data-testid="po-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PO number or supplier…" className="field pl-9 py-2.5" />
        </div>
        <select data-testid="po-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className="field w-auto py-2.5">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option><option value="approved">Approved</option>
          <option value="partially_received">Part received</option><option value="received">Received</option><option value="cancelled">Cancelled</option>
        </select>
        <select data-testid="po-branch-filter" value={branch} onChange={(e) => setBranch(e.target.value)} className="field w-auto py-2.5">
          <option value="all">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="self-center text-sm text-slate-500">{rows.length} order{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {rows.length === 0 ? (
        <div className="card p-16 text-center"><ClipboardList size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">No purchase orders yet</p>
          <button onClick={() => setDrawer(true)} className="btn btn-primary mt-4 gap-1"><Plus size={14} />Create the first PO</button></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr_1.2fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>PO number</span><span>Supplier</span><span>Branch</span><span className="text-right">Value</span><span>Progress</span><span>Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((po) => {
              const lines: any[] = Array.isArray(po.lines) ? po.lines : [];
              const ordered = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
              const got = lines.reduce((a, l) => a + (Number(l.received_qty) || 0), 0);
              const isOpen = expandedId === po.id;
              return (
                <div key={po.id} data-testid="po-row" data-po-no={po.po_no} data-status={po.status} data-branch={po.branch_id} className="transition hover:bg-slate-50/70">
                  <div className="grid cursor-pointer grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr_1.2fr]"
                    onClick={() => setExpandedId(isOpen ? null : po.id)}>
                    <span className="font-mono text-sm font-semibold text-navy-900">{po.po_no}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-navy-900">{po.supplier_name}</span>
                      <span className="text-xs text-slate-400">{po.order_date}</span></span>
                    <span className="text-sm text-slate-600">{branchName(po.branch_id)}</span>
                    <span className="text-sm font-bold text-navy-900 sm:text-right">{inr(po.grand_total)}</span>
                    <span className="text-xs text-slate-500">{got}/{ordered} units</span>
                    <span className="flex items-center justify-between gap-1">
                      <Pill tone={STATUS_TONE[po.status] ?? "grey"}>{STATUS_LABEL[po.status] ?? po.status}</Pill>
                      <ChevronDown size={15} className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </div>
                  <AnimatePresence>{isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 bg-slate-50/40">
                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          {po.status === "draft" && <button data-testid="row-approve" disabled={busy === po.id} onClick={() => run(po.id, () => approvePO(po.id))} className="btn btn-primary !py-2 text-sm"><CheckCircle2 size={14} />Approve</button>}
                          {(po.status === "approved" || po.status === "partially_received") &&
                            <button data-testid="row-receive" disabled={busy === po.id} onClick={() => setRecvPo(po)} className="btn btn-gold !py-2 text-sm"><PackageCheck size={14} />Receive goods</button>}
                          {(po.status === "draft" || po.status === "approved") && <button data-testid="row-cancel" disabled={busy === po.id} onClick={() => run(po.id, () => cancelPO(po.id))} className="btn btn-ghost !py-2 text-sm text-rose-600"><XCircle size={14} />Cancel</button>}
                          <button onClick={(e) => { e.stopPropagation(); setDetailId(po.id); }} className="btn btn-ghost !py-2 text-sm">Full details</button>
                        </div>
                        <div className="space-y-1.5">
                          {lines.slice(0, 6).map((l) => {
                            const left = (Number(l.qty) || 0) - (Number(l.received_qty) || 0);
                            return (
                              <div key={l.product_id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-slate-600">{l.description} <span className="font-mono text-xs text-slate-400">{l.sku ?? ""}</span></span>
                                <span className="shrink-0"><Pill tone={left <= 0 ? "green" : Number(l.received_qty) > 0 ? "gold" : "grey"}>{l.received_qty ?? 0}/{l.qty}</Pill></span>
                              </div>);
                          })}
                          {lines.length > 6 && <p className="text-xs text-slate-400">… and {lines.length - 6} more line(s)</p>}
                        </div>
                      </div>
                    </motion.div>)}
                  </AnimatePresence>
                </div>);
            })}
          </div>
        </div>)}

      {drawer && <PODrawer suppliers={suppliers} branches={branches} products={products} onClose={() => setDrawer(false)} />}
      {detail && <Detail po={detail} busy={busy === detail.id} branchName={branchName} onClose={() => setDetailId(null)}
        onApprove={() => run(detail.id, () => approvePO(detail.id))}
        onCancel={() => run(detail.id, () => cancelPO(detail.id))}
        onReceive={() => setRecvPo(detail)} />}
      {recvPo && <ReceiveModal po={recvPo} onClose={() => setRecvPo(null)} />}
    </div>);
}
