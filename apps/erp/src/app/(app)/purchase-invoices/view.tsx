"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { Plus, Search, Filter, Download, Pencil, Trash2, CheckCircle2, IndianRupee, FileText, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, X, ReceiptText, Building2, Calendar, CreditCard } from "lucide-react";
import { upsertInvoice, markPaid, deleteInvoice, claimITC, createSupplier, updateSupplier } from "./actions";

const TAX_RATES = [0, 5, 12, 18, 28];
const STATES = ["Tamil Nadu","Andhra Pradesh","Karnataka","Kerala","Maharashtra","Delhi","Gujarat","Rajasthan","West Bengal","Punjab","Haryana","Other"];
const PAY_MODES = ["Cash","Bank Transfer","Cheque","UPI","NEFT/RTGS","Credit Card"];
type Line = { description: string; hsn: string; qty: string; rate: string; tax_pct: string };
const EMPTY_LINE: Line = { description:"", hsn:"", qty:"1", rate:"", tax_pct:"18" };
const inr = (n: any) => `₹${Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const fmt2 = (n: any) => Number(n||0).toFixed(2);

function calcLine(l: Line, supply: string) {
  const q = +l.qty||0, r = +l.rate||0, t = +l.tax_pct||0;
  const taxable = q*r, tax = taxable*t/100;
  return { taxable, cgst: supply==="intrastate"?tax/2:0, sgst: supply==="intrastate"?tax/2:0, igst: supply==="interstate"?tax:0, total: taxable+tax };
}
function sumLines(lines: Line[], supply: string) {
  return lines.reduce((a, l) => { const c = calcLine(l, supply); return { taxable: a.taxable+c.taxable, cgst: a.cgst+c.cgst, sgst: a.sgst+c.sgst, igst: a.igst+c.igst, grand: a.grand+c.total }; }, { taxable:0, cgst:0, sgst:0, igst:0, grand:0 });
}

const L = ({ t, req, children }: { t: string; req?: boolean; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{t}{req && <span className="text-rose-500 ml-0.5">*</span>}</span>{children}</label>;

/* ── Supplier Form ────────────────────────────────────────────────────────── */
function SupplierForm({ init, onSave, onClose }: { init?: any; onSave: (s: any) => void; onClose: () => void }) {
  const [f, setF] = useState({ name: init?.name??"", gstin: init?.gstin??"", state: init?.state??"Tamil Nadu", address: init?.address??"", phone: init?.phone??"", email: init?.email??"", contact_person: init?.contact_person??"" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const toast = useToast(); const router = useRouter();
  async function save() {
    if (!f.name.trim()) return setErr("Supplier name is required");
    setBusy(true); setErr("");
    const fd = new FormData(); Object.entries(f).forEach(([k,v]) => fd.set(k, v));
    const r = init?.id ? await updateSupplier(init.id, fd) : await createSupplier(fd);
    setBusy(false); if (r.error) return setErr(r.error);
    toast(r.ok!); router.refresh();
    onSave(r.supplier ?? { ...f, id: init?.id }); onClose();
  }
  return (
    <div className="space-y-3">
      <L t="Supplier name" req><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} className="field"/></L>
      <div className="grid gap-3 sm:grid-cols-2">
        <L t="GSTIN"><input value={f.gstin} onChange={e=>setF({...f,gstin:e.target.value.toUpperCase()})} maxLength={15} placeholder="33ABCDE1234F1Z5" className="field font-mono text-sm"/></L>
        <L t="State"><select value={f.state} onChange={e=>setF({...f,state:e.target.value})} className="field">{STATES.map(s=><option key={s}>{s}</option>)}</select></L>
        <L t="Phone"><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} className="field"/></L>
        <L t="Email"><input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="field"/></L>
      </div>
      <L t="Contact person"><input value={f.contact_person} onChange={e=>setF({...f,contact_person:e.target.value})} className="field"/></L>
      <L t="Address"><textarea value={f.address} onChange={e=>setF({...f,address:e.target.value})} rows={2} className="field"/></L>
      {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
        <button onClick={save} disabled={busy} className="btn btn-primary flex-1">{busy?"Saving…":init?.id?"Update":"Add supplier"}</button>
      </div>
    </div>);
}

/* ── Pay Modal ────────────────────────────────────────────────────────────── */
function PayModal({ inv, onClose }: { inv: any; onClose: () => void }) {
  const balance = Number(inv.grand_total) - Number(inv.paid_amount);
  const [f, setF] = useState({ paid_amount: fmt2(balance), payment_date: new Date().toISOString().slice(0,10), payment_mode:"Bank Transfer", payment_ref:"" });
  const [busy, setBusy] = useState(false); const toast = useToast(); const router = useRouter();
  async function save() {
    setBusy(true);
    const r = await markPaid(inv.id, { paid_amount: Number(f.paid_amount), payment_date: f.payment_date, payment_mode: f.payment_mode, payment_ref: f.payment_ref });
    setBusy(false); if (r.error) return toast(r.error, "err"); toast(r.ok!); router.refresh(); onClose();
  }
  return (
    <Modal open onClose={onClose} title={`Record payment — ${inv.invoice_no}`} subtitle={`${inv.supplier_name} · Balance: ${inr(balance)}`}>
      <div className="p-5 space-y-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div><p className="text-slate-500 text-xs">Invoice total</p><p className="font-bold text-navy-900">{inr(inv.grand_total)}</p></div>
          <div><p className="text-slate-500 text-xs">Already paid</p><p className="font-bold text-emerald-600">{inr(inv.paid_amount)}</p></div>
          <div><p className="text-slate-500 text-xs">Balance due</p><p className="font-bold text-rose-600">{inr(balance)}</p></div>
        </div>
        <L t="Amount paying" req><input type="number" step="0.01" value={f.paid_amount} onChange={e=>setF({...f,paid_amount:e.target.value})} className="field"/></L>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="Payment date"><input type="date" value={f.payment_date} onChange={e=>setF({...f,payment_date:e.target.value})} className="field"/></L>
          <L t="Payment mode"><select value={f.payment_mode} onChange={e=>setF({...f,payment_mode:e.target.value})} className="field">{PAY_MODES.map(m=><option key={m}>{m}</option>)}</select></L>
        </div>
        <L t="Reference / Cheque no."><input value={f.payment_ref} onChange={e=>setF({...f,payment_ref:e.target.value})} placeholder="UTR / Cheque no. (optional)" className="field"/></L>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={save} disabled={busy} className="btn btn-primary flex-1">{busy?"Saving…":"Record payment"}</button>
        </div>
      </div>
    </Modal>);
}

/* ── Invoice Drawer ───────────────────────────────────────────────────────── */
function InvoiceDrawer({ inv, suppliers, branches, onClose }: { inv: any|null; suppliers: any[]; branches: any[]; onClose: () => void }) {
  const isEdit = !!inv?.id;
  const [supSearch, setSupSearch] = useState(inv?.supplier_name??"");
  const [selSup, setSelSup] = useState<any>(inv?.supplier_id ? suppliers.find(s=>s.id===inv.supplier_id) : null);
  const [supOpen, setSupOpen] = useState(false);
  const [addSupOpen, setAddSupOpen] = useState(false);
  const [f, setF] = useState({
    invoice_no: inv?.invoice_no??"", invoice_date: inv?.invoice_date??new Date().toISOString().slice(0,10),
    due_date: inv?.due_date??"", po_ref: inv?.po_ref??"",
    supply_type: inv?.supply_type??"intrastate", branch_id: inv?.branch_id??"",
    itc_eligible: inv?.itc_eligible??true, notes: inv?.notes??"", status: inv?.status??"pending",
  });
  const [lines, setLines] = useState<Line[]>(
    inv?.lines?.length ? inv.lines.map((l:any)=>({ description:l.description??"", hsn:l.hsn??"", qty:String(l.qty??"1"), rate:String(l.rate??""), tax_pct:String(l.tax_pct??18) }))
    : [{ ...EMPTY_LINE }]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const toast = useToast(); const router = useRouter();

  const totals = sumLines(lines, f.supply_type);
  const filteredSups = suppliers.filter(s => s.name.toLowerCase().includes(supSearch.toLowerCase()) || (s.gstin??"").toLowerCase().includes(supSearch.toLowerCase()));

  function addLine() { setLines(l=>[...l, {...EMPTY_LINE}]); }
  function removeLine(i: number) { setLines(l=>l.filter((_,n)=>n!==i)); }
  function setLine(i: number, k: keyof Line, v: string) { setLines(l=>l.map((ln,n)=>n===i?{...ln,[k]:v}:ln)); }

  async function save(asDraft=false) {
    setErr(""); setBusy(true);
    const r = await upsertInvoice(inv?.id??null, {
      supplier_id: selSup?.id??null,
      supplier_name: selSup?.name ?? supSearch.trim(),
      supplier_gstin: selSup?.gstin??"",
      ...f, status: asDraft?"draft":f.status,
      lines: lines.map(l=>({ ...l, qty:Number(l.qty)||1, rate:Number(l.rate)||0, tax_pct:Number(l.tax_pct)||0 })),
      itc_eligible: f.itc_eligible,
    });
    setBusy(false);
    if (r.error) return setErr(r.error);
    toast(r.ok!); router.refresh(); onClose();
  }

  return (
    <Drawer open onClose={onClose} title={isEdit?"Edit purchase invoice":"New purchase invoice"} subtitle="All fields marked * are required" wide
      footer={<>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={()=>save(true)} disabled={busy} className="btn btn-ghost border border-slate-200">Save draft</button>
        <button onClick={()=>save(false)} disabled={busy} className="btn btn-gold">{busy?"Saving…":isEdit?"Save changes":"Create invoice"}</button>
      </>}>
      <div className="space-y-5 p-1">

        {/* Supplier */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier Details</p>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-3 text-slate-400"/>
            <input value={supSearch} onChange={e=>{setSupSearch(e.target.value);setSelSup(null);setSupOpen(true);}}
              onFocus={()=>setSupOpen(true)} placeholder="Search or type supplier name *"
              className="field pl-9"/>
            {supOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {filteredSups.map(s=>(
                    <button key={s.id} onClick={()=>{setSelSup(s);setSupSearch(s.name);setSupOpen(false);}}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-navy-50 transition text-sm">
                      <span className="flex-1"><span className="font-semibold">{s.name}</span>{s.gstin&&<span className="ml-2 text-xs text-slate-400 font-mono">{s.gstin}</span>}</span>
                      <span className="text-xs text-slate-400">{s.state}</span>
                    </button>))}
                  {filteredSups.length===0&&<p className="px-3 py-2.5 text-sm text-slate-400">No supplier found.</p>}
                </div>
                <div className="border-t border-slate-100 p-2">
                  <button onClick={()=>{setSupOpen(false);setAddSupOpen(true);}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50">
                    <Plus size={14}/>Add new supplier
                  </button>
                </div>
              </div>)}
          </div>
          {selSup && (
            <div className="rounded-xl bg-white border border-emerald-100 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-slate-700"><b>{selSup.name}</b>{selSup.gstin&&<span className="ml-2 text-xs text-slate-400 font-mono">{selSup.gstin}</span>}<span className="ml-2 text-xs text-slate-400">{selSup.state}</span></span>
              <button onClick={()=>{setSelSup(null);setSupSearch("");}} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
            </div>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Supply type"><select value={f.supply_type} onChange={e=>setF({...f,supply_type:e.target.value})} className="field">
              <option value="intrastate">Intrastate (CGST + SGST)</option>
              <option value="interstate">Interstate (IGST)</option>
            </select></L>
            <L t="Branch"><select value={f.branch_id} onChange={e=>setF({...f,branch_id:e.target.value})} className="field">
              <option value="">All branches</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></L>
          </div>
        </div>

        {/* Invoice details */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Details</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <L t="Invoice no." req><input value={f.invoice_no} onChange={e=>setF({...f,invoice_no:e.target.value})} placeholder="INV-2024-001" className="field"/></L>
            <L t="Invoice date" req><input type="date" value={f.invoice_date} onChange={e=>setF({...f,invoice_date:e.target.value})} className="field"/></L>
            <L t="Due date"><input type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})} className="field"/></L>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="PO reference"><input value={f.po_ref} onChange={e=>setF({...f,po_ref:e.target.value})} placeholder="Optional purchase order ref" className="field"/></L>
            <L t="Status"><select value={f.status} onChange={e=>setF({...f,status:e.target.value})} className="field">
              <option value="pending">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
            </select></L>
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Items</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium w-1/3">Description *</th>
                <th className="pb-2 font-medium w-24">HSN</th>
                <th className="pb-2 font-medium w-16 text-right">Qty</th>
                <th className="pb-2 font-medium w-24 text-right">Rate ₹</th>
                <th className="pb-2 font-medium w-20 text-right">Tax %</th>
                <th className="pb-2 font-medium w-24 text-right">Total ₹</th>
                <th className="pb-2 w-8"/>
              </tr></thead>
              <tbody className="space-y-1">{lines.map((l,i)=>{
                const c = calcLine(l, f.supply_type);
                return (
                  <tr key={i} className="group">
                    <td className="pr-2 py-1"><input value={l.description} onChange={e=>setLine(i,"description",e.target.value)} placeholder="Item description" className="field text-sm py-1.5"/></td>
                    <td className="pr-2 py-1"><input value={l.hsn} onChange={e=>setLine(i,"hsn",e.target.value)} placeholder="HSN" className="field text-sm py-1.5 font-mono"/></td>
                    <td className="pr-2 py-1"><input type="number" min="0" value={l.qty} onChange={e=>setLine(i,"qty",e.target.value)} className="field text-sm py-1.5 text-right"/></td>
                    <td className="pr-2 py-1"><input type="number" min="0" step="0.01" value={l.rate} onChange={e=>setLine(i,"rate",e.target.value)} placeholder="0.00" className="field text-sm py-1.5 text-right"/></td>
                    <td className="pr-2 py-1"><select value={l.tax_pct} onChange={e=>setLine(i,"tax_pct",e.target.value)} className="field text-sm py-1.5 text-right">{TAX_RATES.map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                    <td className="pr-2 py-1 text-right font-medium text-navy-900">{inr(c.total)}</td>
                    <td className="py-1"><button onClick={()=>removeLine(i)} disabled={lines.length<=1} className="opacity-0 group-hover:opacity-100 rounded-lg p-1 hover:bg-rose-50 text-rose-500 transition disabled:hidden"><X size={14}/></button></td>
                  </tr>);})}
              </tbody>
            </table>
          </div>
          <button onClick={addLine} className="flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:underline">
            <Plus size={14}/>Add line
          </button>

          {/* Totals */}
          <div className="rounded-xl bg-white border border-slate-100 p-4 space-y-1.5 text-sm mt-2">
            <div className="flex justify-between text-slate-600"><span>Taxable value</span><span className="font-medium">{inr(totals.taxable)}</span></div>
            {f.supply_type==="intrastate"
              ? <><div className="flex justify-between text-slate-600"><span>CGST</span><span>{inr(totals.cgst)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>SGST</span><span>{inr(totals.sgst)}</span></div></>
              : <div className="flex justify-between text-slate-600"><span>IGST</span><span>{inr(totals.igst)}</span></div>}
            <div className="flex justify-between text-base font-bold text-navy-900 border-t border-slate-100 pt-1.5">
              <span>Grand Total</span><span>{inr(totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* ITC + Notes */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">ITC Eligibility</p>
            <button type="button" role="switch" aria-checked={f.itc_eligible} onClick={()=>setF({...f,itc_eligible:!f.itc_eligible})}
              className={`flex w-full items-center justify-between rounded-xl border p-3 transition ${f.itc_eligible?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-white"}`}>
              <span className="text-sm font-medium">{f.itc_eligible?"ITC eligible ✓":"ITC not eligible (blocked)"}</span>
              <span className={`relative h-6 w-11 rounded-full transition ${f.itc_eligible?"bg-emerald-500":"bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.itc_eligible?"left-[22px]":"left-0.5"}`}/></span>
            </button>
            <p className="text-[11px] text-slate-400">Disable for personal/blocked credit (e.g. food, club, CSR expenses)</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Notes</p>
            <textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={3} placeholder="Internal notes (optional)" className="field text-sm"/>
          </div>
        </div>

        {err && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{err}</div>}
      </div>

      {/* Add supplier modal */}
      {addSupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">Add supplier</h2>
            <SupplierForm onSave={s=>{setSelSup(s);setSupSearch(s.name);}} onClose={()=>setAddSupOpen(false)}/>
          </div>
        </div>)}
    </Drawer>);
}

/* ── Main view ────────────────────────────────────────────────────────────── */
export function PurchaseInvoicesView({ invoices, suppliers, branches, itcSummary }: {
  invoices: any[]; suppliers: any[]; branches: any[]; itcSummary: any[];
}) {
  const router = useRouter(); const toast = useToast();
  const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("all"); const [tab, setTab] = useState<"invoices"|"suppliers">("invoices");
  const [drawerInv, setDrawerInv] = useState<any|null|"new">(null);
  const [payInv, setPayInv] = useState<any|null>(null);
  const [supEdit, setSupEdit] = useState<any|null>(null);
  const [expandedInv, setExpandedInv] = useState<string|null>(null);
  const [busy, setBusy] = useState<string|null>(null);

  const currentPeriod = new Date().toISOString().slice(0,7);
  const currentITC = itcSummary.find(s=>s.period===currentPeriod);
  const prevPeriod = new Date(new Date().setMonth(new Date().getMonth()-1)).toISOString().slice(0,7);
  const prevITC = itcSummary.find(s=>s.period===prevPeriod);

  const filtered = useMemo(()=>invoices.filter(inv=>{
    if (statusFilter!=="all" && inv.status!==statusFilter) return false;
    if (!search.trim()) return true;
    const q=search.toLowerCase();
    return inv.invoice_no.toLowerCase().includes(q)||inv.supplier_name.toLowerCase().includes(q)||(inv.supplier_gstin??"").toLowerCase().includes(q);
  }),[invoices,search,statusFilter]);

  const totals = filtered.reduce((a,inv)=>({
    grand:a.grand+Number(inv.grand_total), paid:a.paid+Number(inv.paid_amount),
    cgst:a.cgst+Number(inv.cgst_amount), sgst:a.sgst+Number(inv.sgst_amount), igst:a.igst+Number(inv.igst_amount),
    itc:a.itc+(inv.itc_eligible?(Number(inv.cgst_amount)+Number(inv.sgst_amount)+Number(inv.igst_amount)):0)
  }),{grand:0,paid:0,cgst:0,sgst:0,igst:0,itc:0});

  async function doDelete(id:string,no:string) {
    if (!confirm(`Delete invoice ${no}? This cannot be undone.`)) return;
    setBusy(id); const r=await deleteInvoice(id); setBusy(null);
    r.error?toast(r.error,"err"):(toast(r.ok!),router.refresh());
  }
  async function doClaim(id:string) {
    const period = prompt("Enter claim period (YYYY-MM):", currentPeriod); if (!period) return;
    const r=await claimITC(id,period); r.error?toast(r.error,"err"):toast(r.ok!);
    router.refresh();
  }

  const statusColor: Record<string, "gold"|"green"|"red"|"grey"|"blue"|"purple"> = { pending:"gold", paid:"green", overdue:"red", draft:"grey", cancelled:"red" };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-3xl font-semibold">Purchase Invoices</h1>
          <p className="text-slate-500 mt-0.5">Track purchases, GST paid and Input Tax Credit (ITC)</p></div>
        <button onClick={()=>setDrawerInv("new")} className="btn btn-gold gap-2"><Plus size={16}/>New invoice</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm w-fit">
        {(["invoices","suppliers"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`relative rounded-xl px-5 py-2 text-sm font-medium capitalize ${tab===t?"text-white":"text-slate-600"}`}>
            {tab===t&&<motion.span layoutId="pitab" className="absolute inset-0 rounded-xl bg-navy-800"/>}
            <span className="relative">{t}</span>
          </button>))}
      </div>

      <AnimatePresence mode="wait">
        {tab==="invoices" && (
          <motion.div key="invoices" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.15}} className="space-y-5">

            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {label:"Total purchases",val:inr(totals.grand),icon:ReceiptText,color:"blue"},
                {label:"Total GST paid",val:inr(totals.cgst+totals.sgst+totals.igst),icon:IndianRupee,color:"violet"},
                {label:"ITC available",val:inr(totals.itc),icon:TrendingUp,color:"emerald"},
                {label:"Balance due",val:inr(totals.grand-totals.paid),icon:AlertTriangle,color:totals.grand-totals.paid>0?"rose":"slate"},
              ].map(k=>(
                <div key={k.label} className="card p-5 flex items-center gap-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl bg-${k.color}-50 text-${k.color}-600`}><k.icon size={22}/></span>
                  <div><p className="text-sm text-slate-500">{k.label}</p><p className="text-2xl font-bold text-navy-900">{k.val}</p></div>
                </div>))}
            </div>

            {/* ITC summary for current period */}
            {currentITC && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-navy-900 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500"/>ITC Summary — {currentPeriod}</p>
                  <span className="text-xs text-slate-400">For GSTR-3B filing</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Eligible CGST",currentITC.eligible_cgst],["Eligible SGST",currentITC.eligible_sgst],["Eligible IGST",currentITC.eligible_igst],["Total ITC",currentITC.total_itc]].map(([l,v])=>(
                    <div key={l as string} className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-medium">{l}</p>
                      <p className="text-xl font-bold text-emerald-800">{inr(v)}</p>
                    </div>))}
                </div>
                {prevITC && <p className="text-xs text-slate-400 mt-2">Previous month ({prevPeriod}): {inr(prevITC.total_itc)} ITC · {inr(prevITC.claimed_itc)} claimed</p>}
              </div>)}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={15} className="absolute left-3 top-3 text-slate-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by invoice no., supplier, GSTIN…" className="field pl-9 py-2.5"/>
              </div>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="field w-auto py-2.5 pl-4 pr-8">
                <option value="all">All statuses</option>
                <option value="pending">Pending payment</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <span className="self-center text-sm text-slate-500">{filtered.length} invoice{filtered.length!==1?"s":""}</span>
            </div>

            {/* Table */}
            {filtered.length===0
              ? <div className="card p-16 text-center"><FileText size={40} className="mx-auto mb-3 text-slate-200"/><p className="font-semibold text-slate-500">No invoices found</p><button onClick={()=>setDrawerInv("new")} className="btn btn-primary mt-4 gap-1"><Plus size={14}/>Add first invoice</button></div>
              : <div className="card overflow-hidden">
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 bg-slate-50 border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">
                    <span>Invoice / Supplier</span><span>Date</span><span className="text-right">Total</span>
                    <span className="text-right">CGST/IGST</span><span className="text-right">SGST</span><span>ITC / Status</span><span/>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {filtered.map(inv=>{
                      const balance = Number(inv.grand_total)-Number(inv.paid_amount);
                      const isExpanded = expandedInv===inv.id;
                      return (
                        <div key={inv.id} className="transition hover:bg-slate-50/70">
                          <div className="grid sm:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center px-4 py-3 cursor-pointer" onClick={()=>setExpandedInv(isExpanded?null:inv.id)}>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-navy-900 truncate">{inv.invoice_no}</p>
                              <p className="text-xs text-slate-500 truncate">{inv.supplier_name}</p>
                              {inv.supplier_gstin&&<p className="text-[10px] text-slate-400 font-mono">{inv.supplier_gstin}</p>}
                            </div>
                            <div className="text-sm text-slate-600">
                              <p>{new Date(inv.invoice_date).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>
                              {inv.due_date&&<p className="text-xs text-slate-400">Due {new Date(inv.due_date).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>}
                            </div>
                            <p className="text-sm font-bold text-navy-900 text-right">{inr(inv.grand_total)}</p>
                            <p className="text-sm text-right text-slate-600">{inv.supply_type==="intrastate"?inr(inv.cgst_amount):inr(inv.igst_amount)}</p>
                            <p className="text-sm text-right text-slate-600">{inv.supply_type==="intrastate"?inr(inv.sgst_amount):"—"}</p>
                            <div className="flex flex-wrap gap-1">
                              <Pill tone={inv.itc_eligible?"green":"grey"}>{inv.itc_eligible?"ITC":"No ITC"}</Pill>
                              <Pill tone={statusColor[inv.status]??"grey"}>{inv.status}</Pill>
                            </div>
                            <button className="rounded-lg p-1.5 hover:bg-slate-100"><ChevronDown size={15} className={`text-slate-400 transition ${isExpanded?"rotate-180":""}`}/></button>
                          </div>

                          {/* Expanded row */}
                          <AnimatePresence>{isExpanded && (
                            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden border-t border-slate-100">
                              <div className="px-4 pb-4 pt-3 bg-slate-50">
                                {/* Line items */}
                                {inv.lines?.length>0&&(
                                  <div className="rounded-xl bg-white border border-slate-100 overflow-hidden mb-3">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-slate-500"><tr>
                                        <th className="px-3 py-2 text-left font-medium">Description</th>
                                        <th className="px-3 py-2 text-left font-medium">HSN</th>
                                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                                        <th className="px-3 py-2 text-right font-medium">Rate</th>
                                        <th className="px-3 py-2 text-right font-medium">Tax%</th>
                                        <th className="px-3 py-2 text-right font-medium">Total</th>
                                      </tr></thead>
                                      <tbody className="divide-y divide-slate-50">{inv.lines.map((l:any,i:number)=>(
                                        <tr key={i}><td className="px-3 py-1.5">{l.description}</td><td className="px-3 py-1.5 font-mono">{l.hsn||"—"}</td>
                                          <td className="px-3 py-1.5 text-right">{l.qty}</td><td className="px-3 py-1.5 text-right">{inr(l.rate)}</td>
                                          <td className="px-3 py-1.5 text-right">{l.tax_pct}%</td><td className="px-3 py-1.5 text-right font-medium">{inr(l.line_total)}</td>
                                        </tr>))}</tbody>
                                    </table>
                                  </div>)}
                                {/* Payment info */}
                                <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                                  {Number(inv.paid_amount)>0&&<span className="text-emerald-600">Paid: {inr(inv.paid_amount)}</span>}
                                  {balance>0&&<span className="text-rose-600 font-medium">Balance: {inr(balance)}</span>}
                                  {inv.payment_mode&&<span className="text-slate-500">{inv.payment_mode}{inv.payment_ref?` · ${inv.payment_ref}`:""}</span>}
                                  {inv.itc_claimed&&<span className="text-emerald-700 font-medium">ITC claimed {inv.itc_claim_period}</span>}
                                  {inv.notes&&<span className="text-slate-400 italic">{inv.notes}</span>}
                                </div>
                                {/* Actions */}
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={()=>setDrawerInv(inv)} className="btn btn-ghost !py-1.5 text-xs gap-1"><Pencil size={12}/>Edit</button>
                                  {balance>0&&inv.status!=="cancelled"&&<button onClick={()=>setPayInv(inv)} className="btn btn-primary !py-1.5 text-xs gap-1"><CreditCard size={12}/>Record payment</button>}
                                  {inv.itc_eligible&&!inv.itc_claimed&&inv.status==="paid"&&<button onClick={()=>doClaim(inv.id)} className="btn btn-ghost !py-1.5 text-xs gap-1 text-emerald-700"><CheckCircle2 size={12}/>Claim ITC</button>}
                                  <button onClick={()=>doDelete(inv.id,inv.invoice_no)} disabled={busy===inv.id} className="btn btn-ghost !py-1.5 text-xs gap-1 text-rose-600"><Trash2 size={12}/>{busy===inv.id?"…":"Delete"}</button>
                                </div>
                              </div>
                            </motion.div>)}
                          </AnimatePresence>
                        </div>);})}
                  </div>
                </div>}

            {/* ITC history */}
            {itcSummary.length>0&&(
              <div className="card overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3"><p className="font-semibold text-sm">ITC History by Period</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500"><tr>
                      <th className="px-4 py-2.5 text-left font-medium">Period</th>
                      <th className="px-4 py-2.5 text-right font-medium">Invoices</th>
                      <th className="px-4 py-2.5 text-right font-medium">Purchases</th>
                      <th className="px-4 py-2.5 text-right font-medium">CGST</th>
                      <th className="px-4 py-2.5 text-right font-medium">SGST</th>
                      <th className="px-4 py-2.5 text-right font-medium">IGST</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total ITC</th>
                      <th className="px-4 py-2.5 text-right font-medium">Claimed</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {itcSummary.slice(0,12).map(s=>(
                        <tr key={s.period} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium">{s.period}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{s.invoice_count}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{inr(s.total_purchases)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{inr(s.eligible_cgst)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{inr(s.eligible_sgst)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{inr(s.eligible_igst)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{inr(s.total_itc)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{inr(s.claimed_itc)}</td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
              </div>)}
          </motion.div>)}

        {tab==="suppliers" && (
          <motion.div key="suppliers" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
            <div className="flex justify-end"><button onClick={()=>setSupEdit({})} className="btn btn-primary gap-1"><Plus size={15}/>Add supplier</button></div>
            {suppliers.length===0
              ? <div className="card p-16 text-center"><Building2 size={40} className="mx-auto mb-3 text-slate-200"/><p className="text-slate-500">No suppliers yet. Add one above.</p></div>
              : <div className="card overflow-hidden divide-y divide-slate-100">
                  {suppliers.map(s=>(
                    <div key={s.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-navy-100 text-navy-800 font-bold text-sm shrink-0">{s.name[0].toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          {s.gstin&&<span className="font-mono">{s.gstin}</span>}
                          {s.state&&<span>{s.state}</span>}
                          {s.phone&&<span>{s.phone}</span>}
                          {s.email&&<span>{s.email}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={()=>setSupEdit(s)} className="btn btn-ghost !py-1.5 text-xs gap-1"><Pencil size={12}/>Edit</button>
                        <Pill tone={s.status==="active"?"green":"grey"}>{s.status}</Pill>
                      </div>
                    </div>))}
                </div>}

            {supEdit!==null&&(
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                  <h2 className="font-display text-xl font-bold text-navy-900 mb-4">{supEdit?.id?"Edit":"Add"} supplier</h2>
                  <SupplierForm init={supEdit?.id?supEdit:undefined} onSave={()=>router.refresh()} onClose={()=>setSupEdit(null)}/>
                </div>
              </div>)}
          </motion.div>)}
      </AnimatePresence>

      {/* Invoice drawer */}
      {drawerInv!==null&&(
        <InvoiceDrawer inv={drawerInv==="new"?null:drawerInv} suppliers={suppliers} branches={branches} onClose={()=>setDrawerInv(null)}/>)}

      {/* Pay modal */}
      {payInv&&<PayModal inv={payInv} onClose={()=>setPayInv(null)}/>}
    </div>);
}
