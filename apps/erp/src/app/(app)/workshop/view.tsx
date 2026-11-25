"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Modal, Pill, useToast } from "@poweros/ui";
import { AlertTriangle, ClipboardCopy, Flame, Printer, ShoppingBasket, Wrench } from "lucide-react";
import { fmt, inr } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { advanceLab, updateLab } from "./actions";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";

const COLS = [["to_buy", "To buy", "bg-amber-400"], ["ordered", "Ordered", "bg-blue-400"], ["received", "Received", "bg-indigo-400"], ["edging", "Edging", "bg-violet-400"], ["fitting", "Fitting", "bg-fuchsia-400"], ["qc", "Quality check", "bg-orange-400"], ["ready", "Ready", "bg-emerald-500"]] as const;
const NEXT: Record<string, [string, string]> = { to_buy: ["ordered", "Mark as ordered"], ordered: ["received", "Lenses received"], received: ["edging", "Start edging"], edging: ["fitting", "Move to fitting"], fitting: ["qc", "Send to QC"] };
const CHECKS = ["Power, axis and PD match the prescription", "Frame fit and alignment checked", "Lenses clean, no scratches or chips", "Cleaned, packed with case"];
const eyeTxt = (l: any, s: "od" | "os") => { const sp = l[`${s}_sph`], cy = l[`${s}_cyl`], ax = l[`${s}_axis`], ad = l[`${s}_add`]; if (sp == null && cy == null) return "-"; return `${fmt(sp) || "0.00"}${cy != null ? ` / ${fmt(cy)}` : ""}${ax != null ? ` x ${ax}` : ""}${ad ? `  ADD ${fmt(ad)}` : ""}`; };
const overdue = (l: any) => l.due_date && new Date(l.due_date) < new Date(new Date().toDateString());
const dd = (x: string) => new Date(x).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Detail({ lab, onClose, suppliers }: { lab: any | null; onClose: () => void; suppliers: string[] }) {
  const router = useRouter(); const toast = useToast(); const [ev, setEv] = useState<any[]>([]); const [sup, setSup] = useState(""); const [note, setNote] = useState(""); const [checks, setChecks] = useState<boolean[]>([false, false, false, false]); const [busy, setBusy] = useState(false);
  const [tech, setTech] = useState(""); const [pri, setPri] = useState<"normal" | "urgent">("normal"); const [due, setDue] = useState("");
  useEffect(() => { if (!lab) return; setSup(lab.supplier_name ?? ""); setNote(""); setChecks([false, false, false, false]); setTech(lab.assigned_to ?? ""); setPri(lab.priority); setDue(lab.due_date ?? "");
    supabaseBrowser().from("lab_events").select("*").eq("lab_order_id", lab.id).order("at").then(({ data }) => setEv(data ?? [])); }, [lab?.id, lab?.status]);
  if (!lab) return <Modal open={false} onClose={onClose} title="" children={null} />;
  async function go(to: string, n?: string) { setBusy(true); const r = await advanceLab([lab.id], to, n, sup); setBusy(false); if (r.error) return toast(r.error, "err"); toast(r.ok!); router.refresh(); }
  async function saveMeta() { const r = await updateLab(lab.id, { assigned_to: tech, priority: pri, due_date: due }); r.error ? toast(r.error, "err") : (toast("Saved"), router.refresh()); }
  const c = lab.customers; const bal = Number(lab.sales?.grand_total) - Number(lab.sales?.paid_total);
  // Customer message now comes from the message_templates settings.
  const nx = NEXT[lab.status];
  return (<Modal open onClose={onClose} wide title={`${lab.code} | ${c.full_name}`} subtitle={`Order ${lab.sales?.code} | ${c.vision_id} | Prescription ${lab.rx_code ?? "-"}`}>
    <div className="grid gap-4 p-6 lg:grid-cols-[1fr_320px]"><div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">{(["od", "os"] as const).map((s) => <div key={s} className={`rounded-2xl border p-4 ${s === "od" ? "border-blue-200 bg-blue-50/40" : "border-orange-200 bg-orange-50/40"}`}>
        <p className={`text-sm font-semibold ${s === "od" ? "text-blue-700" : "text-orange-600"}`}>{s === "od" ? "Right eye (OD)" : "Left eye (OS)"}</p><p className="mt-1 text-lg font-bold">{eyeTxt(lab, s)}</p></div>)}</div>
      <div className="card space-y-1 p-4 text-sm"><p><span className="text-slate-500">Lens:</span> <b>{lab.lens_desc}</b>{lab.lens_details ? ` | ${lab.lens_details}` : ""}</p><p><span className="text-slate-500">Frame:</span> {lab.frame_desc ?? "Customer's own frame"}</p>
        <p><span className="text-slate-500">PD:</span> {lab.pd_far ?? "-"} / {lab.pd_near ?? "-"} mm</p>{lab.supplier_name && <p><span className="text-slate-500">Supplier:</span> {lab.supplier_name}</p>}{lab.qc_note && <p className="text-rose-600">Rework: {lab.qc_note}</p>}</div>
      <div className="card space-y-3 p-4">
        {lab.status === "to_buy" && <><input list="sups" className="field" placeholder="Supplier name" value={sup} onChange={(e) => setSup(e.target.value)} /><datalist id="sups">{suppliers.map((s) => <option key={s} value={s} />)}</datalist></>}
        {lab.status === "qc" && <><p className="text-sm font-semibold">Quality checklist</p>{CHECKS.map((t, i) => <label key={t} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((x, j) => (j === i ? !x : x)))} />{t}</label>)}
          <button disabled={busy || !checks.every(Boolean)} onClick={() => go("ready")} className="btn btn-gold w-full">Pass QC and mark ready</button>
          <textarea className="field" rows={2} placeholder="If it fails, describe the rework needed" value={note} onChange={(e) => setNote(e.target.value)} /><button disabled={busy} onClick={() => go("fitting", note)} className="btn btn-ghost w-full text-rose-600">Send back for rework</button></>}
        {nx && <button disabled={busy} onClick={() => go(nx[0])} className="btn btn-primary w-full">{nx[1]}</button>}
        {lab.status === "ready" && <><WhatsAppSend phone={c.whatsapp || c.phone} doc={lab.sale_id ? { type: "sale", id: lab.sale_id } : undefined}
          keys={["order_ready", "order_in_progress", "order_qc", "balance_due"]}
          vars={{ Name: c.full_name, Item: lab.frame_desc ?? lab.lens_desc ?? "your glasses", Code: lab.sales?.code ?? "", Balance: inr(bal) }}
          defaultKey="order_ready" label="Tell customer it is ready" /><a href="/sales" className="text-center text-sm text-navy-700 underline">Collect payment and deliver in POS & Orders</a></>}
      </div></div>
      <div className="space-y-3"><a href={`/print/lab/${lab.id}`} target="_blank" className="btn btn-ghost w-full"><Printer size={16} />Print job card (A5)</a>
        <div className="card space-y-2 p-4"><input className="field py-2" placeholder="Technician" value={tech} onChange={(e) => setTech(e.target.value)} /><input type="date" className="field py-2" value={due} onChange={(e) => setDue(e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pri === "urgent"} onChange={(e) => setPri(e.target.checked ? "urgent" : "normal")} />Urgent</label><button onClick={saveMeta} className="btn btn-ghost w-full !py-2">Save details</button></div>
        <div className="card p-4"><p className="mb-2 text-sm font-semibold">Timeline</p><ol className="space-y-2 border-l-2 border-slate-100 pl-3 text-xs">{ev.map((e) => <li key={e.id}><b className="capitalize">{e.to_status.replace("_", " ")}</b> <span className="text-slate-500">{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>{e.note && <span className="block text-slate-600">{e.note}</span>}</li>)}
          <li><b>Created</b> <span className="text-slate-500">{new Date(lab.created_at).toLocaleDateString("en-IN")}</span></li></ol></div></div></div></Modal>);
}

function Buying({ labs, suppliers }: { labs: any[]; suppliers: string[] }) {
  const router = useRouter(); const toast = useToast(); const [sel, setSel] = useState<Set<string>>(new Set()); const [sup, setSup] = useState(""); const [busy, setBusy] = useState(false);
  const toBuy = labs.filter((l) => l.status === "to_buy"), ordered = labs.filter((l) => l.status === "ordered");
  const groups = useMemo(() => { const m = new Map<string, any[]>(); toBuy.forEach((l) => { const k = `${l.lens_desc}${l.lens_details ? ` | ${l.lens_details}` : ""}`; m.set(k, [...(m.get(k) ?? []), l]); }); return [...m]; }, [labs]);
  const tog = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = (list: any[]) => list.filter((l) => sel.has(l.id)).map((l) => l.id);
  async function run(list: string[], to: string) { if (!list.length) return toast("Select at least one", "err"); setBusy(true); const r = await advanceLab(list, to, undefined, sup); setBusy(false); if (r.error) return toast(r.error, "err"); toast(r.ok!); setSel(new Set()); router.refresh(); }
  const text = (list: any[]) => list.map((l) => `${l.code} | ${l.lens_desc}${l.lens_details ? ` (${l.lens_details})` : ""} | R ${eyeTxt(l, "od")} | L ${eyeTxt(l, "os")}`).join("\n");
  const picked = toBuy.filter((l) => sel.has(l.id)); const forList = picked.length ? picked : toBuy;
  return (<div className="space-y-5">
    <div className="card p-4"><div className="flex flex-wrap items-center gap-2"><ShoppingBasket className="text-gold-500" /><p className="font-semibold">Lenses to buy: {toBuy.length}</p><div className="ml-auto flex flex-wrap gap-2">
      <button onClick={() => { navigator.clipboard.writeText(text(forList)); toast("List copied. Paste it to your supplier."); }} className="btn btn-ghost !py-2 text-sm"><ClipboardCopy size={15} />Copy list</button>
      <a href={`/print/buying-list?ids=${forList.map((l) => l.id).join(",")}`} target="_blank" className="btn btn-ghost !py-2 text-sm"><Printer size={15} />Print list</a></div></div></div>
    {groups.length === 0 && <div className="card p-10 text-center text-slate-500">Nothing to buy right now. New lens orders appear here automatically.</div>}
    {groups.map(([k, list]) => <div key={k} className="card overflow-hidden"><div className="flex items-center justify-between bg-navy-50 px-4 py-2"><p className="font-semibold">{k}</p><button className="text-xs text-navy-700 underline" onClick={() => setSel((s) => { const n = new Set(s); list.forEach((l) => n.add(l.id)); return n; })}>Select all {list.length}</button></div>
      <div className="divide-y divide-slate-100">{list.map((l) => <label key={l.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50"><input type="checkbox" checked={sel.has(l.id)} onChange={() => tog(l.id)} />
        <span className="min-w-0 flex-1"><b>{l.code}</b> <span className="text-slate-500">{l.customers.full_name}</span><span className="block text-xs">R {eyeTxt(l, "od")}</span><span className="block text-xs">L {eyeTxt(l, "os")}</span></span>{overdue(l) && <Pill tone="red">overdue</Pill>}<span className="text-xs text-slate-500">due {l.due_date ? dd(l.due_date) : "-"}</span></label>)}</div></div>)}
    {toBuy.length > 0 && <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-xl lg:bottom-4"><input list="sups2" className="field flex-1 py-2" placeholder="Supplier name" value={sup} onChange={(e) => setSup(e.target.value)} /><datalist id="sups2">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
      <button disabled={busy} onClick={() => run(ids(toBuy), "ordered")} className="btn btn-gold">Mark {ids(toBuy).length || ""} as ordered</button></div>}
    {ordered.length > 0 && <div className="card overflow-hidden"><div className="bg-navy-50 px-4 py-2 font-semibold">Ordered, waiting for lenses ({ordered.length})</div><div className="divide-y divide-slate-100">{ordered.map((l) => <label key={l.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50"><input type="checkbox" checked={sel.has(l.id)} onChange={() => tog(l.id)} />
      <span className="min-w-0 flex-1"><b>{l.code}</b> <span className="text-slate-500">{l.customers.full_name} | {l.lens_desc}</span></span><span className="text-xs text-slate-500">{l.supplier_name} | {l.ordered_at ? dd(l.ordered_at) : ""}</span></label>)}</div>
      <div className="p-3"><button disabled={busy} onClick={() => run(ids(ordered), "received")} className="btn btn-primary w-full">Mark {ids(ordered).length || ""} as received</button></div></div>}
  </div>);
}

export function WorkshopView({ labs }: { labs: any[] }) {
  const [tab, setTab] = useState<"board" | "buy">("board"); const [openId, setOpenId] = useState<string | null>(null);
  const suppliers = useMemo(() => [...new Set(labs.map((l) => l.supplier_name).filter(Boolean))] as string[], [labs]);
  const late = labs.filter(overdue).length; const open = labs.find((l) => l.id === openId) ?? null;
  const urgent = labs.filter((l) => l.priority === "urgent").length; const ready = labs.filter((l) => l.status === "ready").length; const qc = labs.filter((l) => l.status === "qc").length; const toBuyCount = labs.filter((l) => l.status === "to_buy").length;
  return (<div className="mx-auto max-w-[1400px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold">Workshop & Lab</h1><p className="text-slate-500">{labs.length} jobs in progress{late > 0 && <span className="ml-2 inline-flex items-center gap-1 font-medium text-rose-600"><AlertTriangle size={14} />{late} overdue</span>}</p></div>
      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">{([["board", "Board", Wrench], ["buy", "Buying list", ShoppingBasket]] as const).map(([k, l, I]) => <button key={k} onClick={() => setTab(k)} className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${tab === k ? "text-white" : "text-slate-600"}`}>
        {tab === k && <motion.span layoutId="wtab" className="absolute inset-0 rounded-xl bg-navy-800" />}<span className="relative flex items-center gap-2"><I size={15} />{l}{k === "buy" && labs.filter((x) => x.status === "to_buy").length > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] text-white">{labs.filter((x) => x.status === "to_buy").length}</span>}</span></button>)}</div></div>
    <ModuleKpiGrid items={[{label:"Active lab jobs",value:labs.length,detail:"Jobs currently in the workflow",icon:KPIIcons.package},{label:"Awaiting lens purchase",value:toBuyCount,detail:"Need supplier/order action",tone:toBuyCount?"warning":"success",icon:KPIIcons.warning},{label:"Awaiting QC",value:qc,detail:"Inspection/rework decision needed",tone:qc?"warning":"default",icon:KPIIcons.check},{label:"Ready for delivery",value:ready,detail:"Passed QC; next customer delivery step",tone:ready?"success":"default",icon:KPIIcons.check},{label:"Overdue / urgent",value:`${late} / ${urgent}`,detail:"Due-date and priority exceptions",tone:late||urgent?"danger":"success",icon:KPIIcons.clock}]} />
    {tab === "buy" ? <Buying labs={labs} suppliers={suppliers} /> : labs.length === 0 ? <div className="card p-10 text-center text-slate-500"><Wrench className="mx-auto mb-2" />No jobs yet. A lab order is created automatically when an order includes lenses.</div> :
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">{COLS.map(([k, label, dot]) => { const list = labs.filter((l) => l.status === k); return (
        <section key={k} className="w-72 shrink-0 snap-start rounded-2xl bg-slate-100/70 p-2"><header className="flex items-center gap-2 px-2 py-2 text-sm font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{label}<span className="ml-auto rounded-full bg-white px-2 text-xs">{list.length}</span></header>
          <div className="space-y-2"><AnimatePresence>{list.map((l) => (<motion.button layout key={l.id} initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} whileHover={{ y: -2 }} onClick={() => setOpenId(l.id)} className="card w-full p-3 text-left">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-navy-700">{l.code}</span>{l.priority === "urgent" && <Flame size={14} className="text-rose-500" />}</div>
            <p className="font-semibold">{l.customers.full_name}</p><p className="truncate text-xs text-slate-500">{l.lens_desc}{l.lens_details ? ` | ${l.lens_details}` : ""}</p><p className="mt-1 text-[11px]">R {eyeTxt(l, "od")}</p><p className="text-[11px]">L {eyeTxt(l, "os")}</p>
            <div className="mt-2 flex items-center justify-between text-[11px]"><span className={overdue(l) ? "font-semibold text-rose-600" : "text-slate-500"}>{overdue(l) ? "Overdue " : "Due "}{l.due_date ? dd(l.due_date) : "-"}</span>{l.assigned_to && <span className="text-slate-500">{l.assigned_to}</span>}</div></motion.button>))}</AnimatePresence>
            {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">Empty</p>}</div></section>); })}</div>}
    <Detail lab={open} onClose={() => setOpenId(null)} suppliers={suppliers} /></div>);
}
