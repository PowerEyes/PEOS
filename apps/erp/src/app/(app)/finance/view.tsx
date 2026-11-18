"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { CalendarCheck, Plus, Printer, RefreshCw, Search } from "lucide-react";
import { inr } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { addExpense, saveDayClosing, createCreditNote, closePeriod } from "./actions";

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (arr: any[], k: string) => arr.reduce((a: number, r: any) => a + Number(r[k] ?? 0), 0);
const L = ({ t, children }: { t: string; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-xs text-slate-500">{t}</span>{children}</label>;
const TABS = ["Dashboard", "GST Ledger", "Expenses", "Day Closing", "Credit Notes", "Reports"] as const;
const EXP_CATS = ["Rent","Electricity","Salaries","Marketing","Office Supplies","Repairs & Maintenance","Transport","Professional Fees","Other"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function FinanceView({ settings, salesMonth, salesToday, outstanding, expenses, purchasesMonth, branches, days30, creditNotes, gstPeriods }: any) {
  const router = useRouter(); const toast = useToast(); const sp = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [expOpen, setExpOpen] = useState(false);
  const [dcOpen, setDcOpen] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);
  const [cnSale, setCnSale] = useState<any>(null);
  const [cnSearch, setCnSearch] = useState(""); const [cnResults, setCnResults] = useState<any[]>([]);
  const [cnSearching, setCnSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expF, setExpF] = useState({ category: "", description: "", amount: "", expense_date: new Date().toISOString().slice(0,10), payment_method: "cash", reference: "", branch_id: branches[0]?.id ?? "" });
  const [dcF, setDcF] = useState({ branch_id: branches[0]?.id ?? "", closing_date: new Date().toISOString().slice(0,10), opening_cash: "", actual_cash: "", notes: "" });
  const [cnF, setCnF] = useState({ reason: "", refund_method: "cash", lines: [] as { line_id: string; desc: string; maxQty: number; qty: number }[] });

  // Handle ?cn=saleId from POS & Orders "Issue credit note" link
  useEffect(() => {
    const saleId = sp.get("cn");
    if (!saleId) return;
    setTab("Credit Notes"); setCnOpen(true);
    supabaseBrowser().from("sales").select("*, customers(full_name, phone), sale_lines(*)").eq("id", saleId).single()
      .then(({ data }) => { if (data) { setCnSale(data); setCnSearch(data.code); } });
  }, []);

  // Search orders for credit note
  useEffect(() => {
    if (!cnOpen || cnSale || cnSearch.length < 2) { setCnResults([]); return; }
    const t = setTimeout(async () => {
      setCnSearching(true);
      const { data } = await supabaseBrowser().from("sales").select("*, customers(full_name), sale_lines(*)")
        .eq("kind","order").not("status","eq","cancelled")
        .or(`code.ilike.%${cnSearch}%,customers.full_name.ilike.%${cnSearch}%`).limit(6);
      setCnResults(data ?? []); setCnSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [cnSearch, cnSale, cnOpen]);

  const revenue = sum(salesMonth, "grand_total"); const revenueToday = sum(salesToday, "grand_total");
  const totalOutstanding = outstanding.reduce((a: number, s: any) => a + Number(s.grand_total) - Number(s.paid_total), 0);
  const totalExpenses = sum(expenses, "amount");
  const outGST = { cgst: sum(salesMonth,"cgst_total"), sgst: sum(salesMonth,"sgst_total"), igst: sum(salesMonth,"igst_total") };
  const inGST = { cgst: sum(purchasesMonth,"cgst_total"), sgst: sum(purchasesMonth,"sgst_total"), igst: sum(purchasesMonth,"igst_total") };
  const netLiab = r2(Math.max(0, (outGST.cgst+outGST.sgst+outGST.igst) - (inGST.cgst+inGST.sgst+inGST.igst)));

  const days = useMemo(() => {
    const m = new Map<string,number>(); days30.forEach((s: any) => { const d = s.created_at.slice(0,10); m.set(d,(m.get(d)??0)+Number(s.grand_total)); });
    const max = Math.max(...m.values(), 1); const arr = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(Date.now()-i*86400000).toISOString().slice(0,10); arr.push({ d: d.slice(5), v: m.get(d)??0, pct: ((m.get(d)??0)/max)*100 }); }
    return arr; }, [days30]);

  async function saveExp() {
    setBusy(true); const r = await addExpense({ ...expF, amount: Number(expF.amount) });
    setBusy(false); if (r.error) return toast(r.error,"err"); toast(r.ok!); router.refresh(); setExpOpen(false); }

  async function saveDC() {
    const total = days30.filter((s: any) => s.created_at.slice(0,10) === dcF.closing_date).reduce((a: number, s: any) => a + Number(s.grand_total), 0);
    setBusy(true);
    const r = await saveDayClosing({ ...dcF, opening_cash: Number(dcF.opening_cash||0), actual_cash: Number(dcF.actual_cash||0), expected_cash: Number(dcF.opening_cash||0) + total, cash_sales: total, upi_sales: 0, card_sales: 0, bank_sales: 0, total_sales: total, order_count: days30.filter((s: any) => s.created_at.slice(0,10) === dcF.closing_date).length });
    setBusy(false); if (r.error) return toast(r.error,"err"); toast(r.ok!); router.refresh(); setDcOpen(false); }

  async function saveCN() {
    if (!cnSale || !cnF.lines.length) return toast("Select at least one item to return","err");
    setBusy(true);
    const r = await createCreditNote({ sale_id: cnSale.id, reason: cnF.reason, refund_method: cnF.refund_method, lines: cnF.lines.map(l => ({ line_id: l.line_id, qty: l.qty })) });
    setBusy(false); if (r.error) return toast(r.error,"err");
    toast(`Credit note ${r.ok} issued`); router.refresh();
    setCnOpen(false); setCnSale(null); setCnSearch(""); setCnF({ reason:"", refund_method:"cash", lines:[] }); }

  function openCN(sale: any) {
    setCnSale(sale); setCnSearch(sale.code); setCnResults([]);
    setCnF({ reason:"", refund_method:"cash", lines: sale.sale_lines?.map((l: any) => ({ line_id: l.id, desc: l.description, maxQty: l.qty, qty: l.qty })) ?? [] }); }

  const Dash = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Revenue this month", `₹${Math.round(revenue).toLocaleString("en-IN")}`, `Today: ₹${Math.round(revenueToday).toLocaleString("en-IN")}`],
          ["Expenses this month", `₹${Math.round(totalExpenses).toLocaleString("en-IN")}`, `${expenses.length} entries`],
          ["Net (est.)", `₹${Math.round(revenue - totalExpenses).toLocaleString("en-IN")}`, "Revenue minus expenses"],
          ["Outstanding", `₹${Math.round(totalOutstanding).toLocaleString("en-IN")}`, `${outstanding.length} unpaid orders`]].map(([l,v,s]) =>
          <div key={l} className="card p-5"><p className="text-sm text-slate-500">{l}</p><p className="text-3xl font-bold mt-1">{v}</p><p className="text-xs text-slate-500 mt-1">{s}</p></div>)}
      </div>
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between"><p className="font-semibold">GST this month</p></div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-navy-50 p-3"><p className="text-xs text-slate-500">Output GST</p><p className="text-xl font-bold">{inr(r2(outGST.cgst+outGST.sgst+outGST.igst))}</p><p className="text-xs mt-1">CGST {inr(r2(outGST.cgst))} + SGST {inr(r2(outGST.sgst))}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Input ITC</p><p className="text-xl font-bold">{inr(r2(inGST.cgst+inGST.sgst+inGST.igst))}</p><p className="text-xs mt-1">From purchase invoices</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-slate-500">Net liability</p><p className="text-xl font-bold text-amber-700">{inr(netLiab)}</p><p className="text-xs mt-1">Output minus ITC</p></div>
        </div>
      </div>
      <div className="card p-5"><p className="mb-3 font-semibold">Revenue — last 30 days</p>
        <div className="flex items-end gap-px h-28">{days.map((d) => <div key={d.d} title={`${d.d}: ${inr(d.v)}`} className="flex-1 rounded-t transition" style={{ height: `${Math.max(4,d.pct)}%`, background: d.v > 0 ? "linear-gradient(to top,#0E2B4A,#D9A25E)" : "#e2e8f0" }} />)}</div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>{days[0]?.d}</span><span>{days[days.length-1]?.d}</span></div></div>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        <div className="flex justify-between px-4 py-3 font-semibold"><span>Unpaid orders</span><span>{outstanding.length}</span></div>
        {outstanding.slice(0,8).map((s: any) => { const bal = Number(s.grand_total)-Number(s.paid_total); const ph = s.customers?.phone ?? ""; return (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50">
            <span className="min-w-0 flex-1 text-sm"><b>{s.customers?.full_name}</b> {s.code}</span>
            <span className="text-sm font-semibold text-rose-600">{inr(bal)}</span>
            <WhatsAppSend phone={ph} keys={["balance_due"]} defaultKey="balance_due" label="" className="btn btn-ghost !p-1.5 text-emerald-600"
              vars={{ Name: s.customers?.full_name ?? "", Code: s.code, Balance: inr(bal) }} />
          </div>); })}</div></div>);

  const GSTTab = (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Current month GST summary. Add purchase invoices under Finance to claim ITC.</p>
      <div className="card overflow-hidden"><div className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Output Tax (from sales)</div>
        <div className="divide-y divide-slate-100 text-sm">{[["Taxable value",inr(r2(sum(salesMonth,"taxable_total")))],["CGST collected",inr(r2(sum(salesMonth,"cgst_total")))],["SGST collected",inr(r2(sum(salesMonth,"sgst_total")))],["IGST collected",inr(r2(sum(salesMonth,"igst_total")))],["Total Output GST",inr(r2(outGST.cgst+outGST.sgst+outGST.igst))]].map(([k,v]) => <div key={k} className="flex justify-between px-4 py-2.5"><span className="text-slate-600">{k}</span><span className="font-semibold">{v}</span></div>)}</div></div>
      <div className="card overflow-hidden"><div className="bg-slate-700 px-4 py-2 text-sm font-semibold text-white">Input Tax Credit (from purchases)</div>
        <div className="divide-y divide-slate-100 text-sm">{[["CGST ITC",inr(r2(inGST.cgst))],["SGST ITC",inr(r2(inGST.sgst))],["IGST ITC",inr(r2(inGST.igst))],["Total ITC",inr(r2(inGST.cgst+inGST.sgst+inGST.igst))]].map(([k,v]) => <div key={k} className="flex justify-between px-4 py-2.5"><span className="text-slate-600">{k}</span><span className="font-semibold">{v}</span></div>)}</div></div>
      <div className="card bg-amber-50 p-4 flex items-center justify-between"><div><p className="font-semibold text-amber-900">Net GST Liability</p><p className="text-xs text-amber-700">Output GST − Eligible ITC. Pay this amount in the GST portal.</p></div><p className="text-3xl font-bold text-amber-700">{inr(netLiab)}</p></div>
      {gstPeriods.length > 0 && <div className="card overflow-hidden"><div className="px-4 py-2 text-sm font-semibold bg-slate-50">Period history</div>
        <div className="divide-y divide-slate-100 text-sm">{gstPeriods.map((p: any) => <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex-1">{MONTHS[p.period_month-1]} {p.period_year}</span><Pill tone={p.status==="closed"?"green":"gold"}>{p.status}</Pill>
          {p.net_liability != null && <span className="font-semibold">{inr(p.net_liability)}</span>}
          {p.status==="open" && <button onClick={async()=>{const r=await closePeriod(p.period_year,p.period_month);r.error?toast(r.error,"err"):toast(r.ok!);router.refresh();}} className="btn btn-ghost !py-1 text-xs">Close</button>}</div>)}</div></div>}
      <button className="btn btn-ghost" onClick={async()=>{const n=new Date();const r=await closePeriod(n.getFullYear(),n.getMonth()+1);r.error?toast(r.error,"err"):(toast(r.ok!),router.refresh());}}><RefreshCw size={15}/>Close current month</button></div>);

  const ExpTab = (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={()=>setExpOpen(true)} className="btn btn-primary"><Plus size={16}/>Add expense</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(expenses.reduce((a:any,e:any)=>{a[e.category]=(a[e.category]??0)+Number(e.amount);return a;},{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,8).map(([cat,amt]:any)=><div key={cat} className="card p-3 text-sm"><p className="text-slate-500 truncate">{cat}</p><p className="font-bold">{inr(amt)}</p></div>)}</div>
      {expenses.length===0 ? <div className="card p-10 text-center text-slate-500">No expenses this month.</div> :
        <div className="card divide-y divide-slate-100 overflow-hidden">{expenses.map((e:any)=><div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="min-w-0 flex-1"><b>{e.description}</b><span className="block text-xs text-slate-500">{e.category} | {e.expense_date} | {e.payment_method}</span></span><span className="font-semibold">{inr(e.amount)}</span></div>)}</div>}
      <Drawer open={expOpen} onClose={()=>setExpOpen(false)} title="Add expense" footer={<><button onClick={()=>setExpOpen(false)} className="btn btn-ghost">Cancel</button><button disabled={busy} onClick={saveExp} className="btn btn-gold">{busy?"Saving…":"Save expense"}</button></>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><L t="Category"><select className="field" value={expF.category} onChange={e=>setExpF({...expF,category:e.target.value})}><option value="">Select…</option>{EXP_CATS.map(c=><option key={c}>{c}</option>)}</select></L>
            <L t="Amount (₹)"><input className="field" inputMode="decimal" value={expF.amount} onChange={e=>setExpF({...expF,amount:e.target.value})} /></L></div>
          <L t="Description"><input className="field" value={expF.description} onChange={e=>setExpF({...expF,description:e.target.value})} /></L>
          <div className="grid gap-3 sm:grid-cols-2"><L t="Date"><input type="date" className="field" value={expF.expense_date} onChange={e=>setExpF({...expF,expense_date:e.target.value})} /></L>
            <L t="Payment method"><select className="field" value={expF.payment_method} onChange={e=>setExpF({...expF,payment_method:e.target.value})}>{["cash","upi","card","bank"].map(m=><option key={m}>{m}</option>)}</select></L></div>
          <L t="Branch"><select className="field" value={expF.branch_id} onChange={e=>setExpF({...expF,branch_id:e.target.value})}>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
          <L t="Reference (optional)"><input className="field" value={expF.reference} onChange={e=>setExpF({...expF,reference:e.target.value})} /></L></div></Drawer></div>);

  const DCTab = (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Reconcile the day's cash, close the POS and record totals.</p>
      <button onClick={()=>setDcOpen(true)} className="btn btn-primary"><CalendarCheck size={16}/>Close today</button>
      <Drawer open={dcOpen} onClose={()=>setDcOpen(false)} title="Day closing" footer={<><button onClick={()=>setDcOpen(false)} className="btn btn-ghost">Cancel</button><button disabled={busy} onClick={saveDC} className="btn btn-gold">{busy?"Saving…":"Close day"}</button></>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><L t="Branch"><select className="field" value={dcF.branch_id} onChange={e=>setDcF({...dcF,branch_id:e.target.value})}>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></L>
            <L t="Date"><input type="date" className="field" value={dcF.closing_date} onChange={e=>setDcF({...dcF,closing_date:e.target.value})} /></L></div>
          <L t="Opening cash (₹)"><input className="field" inputMode="decimal" value={dcF.opening_cash} onChange={e=>setDcF({...dcF,opening_cash:e.target.value})} /></L>
          <L t="Actual cash in drawer now (₹)"><input className="field" inputMode="decimal" value={dcF.actual_cash} onChange={e=>setDcF({...dcF,actual_cash:e.target.value})} /></L>
          <L t="Notes"><textarea className="field" rows={2} value={dcF.notes} onChange={e=>setDcF({...dcF,notes:e.target.value})} /></L></div></Drawer></div>);

  const CNTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-slate-500">Issue returns against any order. Stock is returned and GST is reversed automatically.</p>
        <button onClick={()=>setCnOpen(true)} className="btn btn-primary"><Plus size={16}/>New credit note</button></div>
      {creditNotes.length===0 ? <div className="card p-10 text-center text-slate-500">No credit notes yet.</div> :
        <div className="card divide-y divide-slate-100 overflow-hidden">{creditNotes.map((c:any)=><div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1"><b className="text-rose-700">{c.code}</b> <span className="text-slate-500">{c.customers?.full_name}</span><span className="block text-xs text-slate-500">{c.reason} | {new Date(c.created_at).toLocaleDateString("en-IN")}</span></span>
          <span className="font-semibold text-rose-600">−{inr(c.grand_total)}</span><Pill tone={c.status==="refunded"?"green":"gold"}>{c.status}</Pill>
          <a href={`/print/credit-note/${c.id}`} target="_blank"><Printer size={15} className="text-slate-500" /></a></div>)}</div>}
      <Modal open={cnOpen} onClose={()=>{setCnOpen(false);setCnSale(null);setCnSearch("");}} title="Issue credit note" subtitle="Find the original order, then select items to return">
        <div className="space-y-4 p-6">
          {/* Step 1: find the order */}
          <div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-slate-400" />
            <input value={cnSearch} onChange={e=>{setCnSearch(e.target.value);setCnSale(null);}} placeholder="Order number (ORD-0001) or customer name" className="field pl-9" />
            {cnSearching && <span className="absolute right-3 top-3 text-xs text-slate-400">Searching…</span>}</div>
          {!cnSale && cnResults.length > 0 && <div className="space-y-1">{cnResults.map((s:any)=><button key={s.id} onClick={()=>openCN(s)} className="flex w-full justify-between rounded-xl border border-slate-100 px-4 py-2.5 text-sm hover:bg-navy-50"><b>{s.code}</b> <span className="text-slate-500">{s.customers?.full_name}</span> <span>{inr(s.grand_total)}</span></button>)}</div>}
          {/* Step 2: select items */}
          {cnSale && <div className="space-y-3">
            <p className="font-semibold text-sm">Order {cnSale.code} — {cnSale.customers?.full_name}</p>
            {(cnSale.sale_lines ?? []).sort((a:any,b:any) => a.line_no-b.line_no).map((l:any)=>{
              const line = cnF.lines.find(x=>x.line_id===l.id);
              return (<label key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={!!line} onChange={e=>setCnF(prev=>({...prev,lines:e.target.checked?[...prev.lines,{line_id:l.id,desc:l.description,maxQty:l.qty,qty:l.qty}]:prev.lines.filter(x=>x.line_id!==l.id)}))} />
                <span className="flex-1"><b>{l.description}</b>{l.details&&<span className="block text-xs text-slate-500">{l.details}</span>}</span>
                <span className="text-slate-500">×{l.qty} | {inr(l.line_total)}</span>
                {line && <input type="number" min={1} max={l.qty} value={line.qty} onClick={e=>e.preventDefault()} onChange={e=>setCnF(prev=>({...prev,lines:prev.lines.map(x=>x.line_id===l.id?{...x,qty:Math.min(l.qty,Math.max(1,Number(e.target.value)))}:x)}))} className="w-16 field py-1 text-center" />}
              </label>);})}
            <L t="Reason for return"><input className="field" value={cnF.reason} onChange={e=>setCnF({...cnF,reason:e.target.value})} placeholder="Customer return, defective product, wrong lens…" /></L>
            <L t="Refund method"><select className="field" value={cnF.refund_method} onChange={e=>setCnF({...cnF,refund_method:e.target.value})}>{["cash","upi","card","bank","store_credit"].map(m=><option key={m} className="capitalize">{m}</option>)}</select></L>
            <button onClick={saveCN} disabled={busy||!cnF.lines.length||!cnF.reason} className="btn btn-gold w-full">{busy?"Issuing credit note…":`Issue credit note for ${cnF.lines.length} item(s)`}</button></div>}</div></Modal></div>);

  const Reports = (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Current month summary. Date-range reports arrive in the next build.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4 space-y-2 text-sm"><p className="font-semibold mb-2">P&L — This month</p>
          {[["Revenue",inr(r2(revenue)),false],["Taxable value",inr(r2(sum(salesMonth,"taxable_total"))),false],["GST collected",inr(r2(outGST.cgst+outGST.sgst+outGST.igst)),false],["Expenses",`−${inr(r2(totalExpenses))}`,true],["Estimated profit",inr(r2(revenue-totalExpenses)),false]].map(([k,v,neg]:any)=><div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className={`font-semibold ${neg?"text-rose-600":""}`}>{v}</span></div>)}</div>
        <div className="card p-4 space-y-2 text-sm"><p className="font-semibold mb-2">GST Return Summary</p>
          {[["CGST Output",inr(r2(outGST.cgst))],["SGST Output",inr(r2(outGST.sgst))],["IGST Output",inr(r2(outGST.igst))],["CGST ITC",`−${inr(r2(inGST.cgst))}`],["SGST ITC",`−${inr(r2(inGST.sgst))}`],["Net Liability",inr(netLiab)]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold">{v}</span></div>)}</div>
      </div>
      <div className="card p-4 text-sm"><p className="font-semibold mb-2">Receivables</p>
        {outstanding.slice(0,10).map((s:any)=>{const bal=Number(s.grand_total)-Number(s.paid_total);return(<div key={s.id} className="flex justify-between py-1 border-b border-slate-50"><span>{s.customers?.full_name} — {s.code}</span><span className="font-semibold text-rose-600">{inr(bal)}</span></div>);})}
        {outstanding.length>10&&<p className="text-xs text-slate-500 mt-2">+{outstanding.length-10} more</p>}</div></div>);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">Finance</h1><p className="text-slate-500">Revenue, GST, expenses and reporting</p></div>
        {!settings.gst && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">GST is OFF — invoices print without tax</div>}
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {TABS.map(t => <button key={t} onClick={()=>setTab(t)} className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${tab===t?"text-white":"text-slate-600 hover:bg-slate-50"}`}>
          {tab===t && <motion.span layoutId="ftab" className="absolute inset-0 rounded-xl bg-navy-800"/>}<span className="relative">{t}</span></button>)}</div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.15}}>
          {tab==="Dashboard" && Dash}
          {tab==="GST Ledger" && GSTTab}
          {tab==="Expenses" && ExpTab}
          {tab==="Day Closing" && DCTab}
          {tab==="Credit Notes" && CNTab}
          {tab==="Reports" && Reports}
        </motion.div>
      </AnimatePresence>
    </div>);
}
