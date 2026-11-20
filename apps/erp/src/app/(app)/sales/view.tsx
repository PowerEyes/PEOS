"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Drawer, Modal, Pill, useToast } from "@poweros/ui";
import { CheckCircle2, Plus, Printer, Search, ShoppingCart, Ban, ArrowRightLeft, Wallet } from "lucide-react";
import { fmt, inr } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WhatsAppSend } from "@/components/WhatsAppSend";
import { Pos } from "./pos";
import { addPayment, cancelOrder, deliverOrder, markSent } from "./actions";
import { createCreditNote } from "@/app/(app)/finance/actions";

const TONE: any = { draft: "grey", sent: "blue", converted: "purple", rejected: "red", expired: "red", lab_pending: "gold", in_workshop: "blue", qc: "blue", ready: "green", delivered: "green", cancelled: "red", unpaid: "red", partial: "gold", paid: "green" };
const eff = (s: any) => (s.kind === "quotation" && ["draft", "sent"].includes(s.status) && s.valid_until && new Date(s.valid_until) < new Date(new Date().toDateString()) ? "expired" : s.status);
const label = (s: string) => s.replace("_", " ");
const WA_DEFAULT: Record<string, string> = { draft: "order_confirmed", sent: "order_confirmed", converted: "order_confirmed", lab_pending: "order_in_progress", in_workshop: "order_in_progress", qc: "order_qc", ready: "order_ready", delivered: "order_delivered", cancelled: "order_cancelled" };

function Detail({ id, onClose, onConvert }: { id: string | null; onClose: () => void; onConvert: (d: any) => void }) {
  const router = useRouter(); const toast = useToast(); const [d, setD] = useState<any>(null); const [tick, setTick] = useState(0); const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", method: "cash", reference: "" }); const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<any[]>([]); const [rxImg, setRxImg] = useState("");
  useEffect(() => { if (!id) { setD(null); setEvents([]); setRxImg(""); return; }
    const sb = supabaseBrowser();
    sb.from("sales").select("*, customers!sales_customer_id_fkey(full_name, phone, whatsapp, vision_id), sale_lines(*), payments(*), branches(name)").eq("id", id).single().then(({ data }) => setD(data));
    sb.from("sale_events").select("from_status, to_status, note, at").eq("sale_id", id).order("at", { ascending: true }).then(({ data }) => setEvents(data ?? []));
    setRxImg("");
  }, [id, tick]);
  // rx_snapshot is a full copy of the prescription row, so the hard-copy image path travels with the sale.
  useEffect(() => { const p = d?.rx_snapshot?.image_path; setRxImg("");
    if (p) supabaseBrowser().storage.from("prescriptions").createSignedUrl(p, 3600).then(({ data }) => setRxImg(data?.signedUrl ?? "")); }, [d?.id]);
  async function run(fn: () => Promise<{ error?: string; ok?: string }>) { setBusy(true); const r = await fn(); setBusy(false); if (r.error) return toast(r.error, "err"); toast(r.ok!); setTick((t) => t + 1); router.refresh(); }
  if (!id) return <Modal open={false} onClose={onClose} title="" children={null} />;
  if (!d) return <Modal open onClose={onClose} title="Loading…" children={<div className="p-10" />} />;
  const status = eff(d); const bal = Number(d.grand_total) - Number(d.paid_total); const lines = [...d.sale_lines].sort((a: any, b: any) => a.line_no - b.line_no);
  const c = d.customers; const phone = c.whatsapp || c.phone; const rx = d.rx_snapshot;
  // Customer messages now come from the message_templates settings.
  return (<><Modal open onClose={onClose} wide title={`${d.kind === "order" ? "Order" : "Quotation"} ${d.code}`} subtitle={`${c.full_name} | ${c.vision_id} | ${d.branches?.name} | ${new Date(d.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}`}>
    <div className="grid gap-4 p-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><Pill tone={TONE[status]}>{label(status)}</Pill>{d.kind === "order" && <Pill tone={TONE[d.payment_status]}>{d.payment_status}</Pill>}{d.needs_lab && <Pill tone="purple">needs lab</Pill>}</div>
        <div className="card divide-y divide-slate-100 overflow-hidden">{lines.map((l: any) => <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-medium">{l.description}</p>{l.details && <p className="text-xs text-slate-500">{l.details}</p>}
          <p className="text-xs text-slate-500">{l.qty} x {inr(l.unit_price)}{Number(l.discount_pct) > 0 ? ` | ${l.discount_pct}% off` : ""}</p></div><p className="font-semibold">{inr(l.line_total)}</p></div>)}</div>
        {rx && <div className="rounded-2xl bg-navy-50 p-4 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="font-semibold">Prescription {rx.rx_code}</p>
            {rx.source === "external" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">External{rx.external_practice ? ` · ${rx.external_practice}` : ""}</span>}
            {d.rx_consent && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" title="Staff record: the customer consented to proceed without a paper prescription.">Rx consent recorded</span>}
            {!d.rx_consent && !rx.image_path && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">No hard copy on file</span>}
          </div>
          <div className="grid grid-cols-2 gap-3"><p>OD: {fmt(rx.od_sph)} / {fmt(rx.od_cyl)} x {rx.od_axis ?? "-"} {rx.od_add ? `ADD ${fmt(rx.od_add)}` : ""}</p><p>OS: {fmt(rx.os_sph)} / {fmt(rx.os_cyl)} x {rx.os_axis ?? "-"} {rx.os_add ? `ADD ${fmt(rx.os_add)}` : ""}</p></div>
          <div className="mt-2 flex items-start gap-3">
            <p className="flex-1 text-xs text-slate-500">PD {rx.pd_far ?? "-"} / {rx.pd_near ?? "-"} mm. Saved with the {d.kind} so later edits do not change it.</p>
            {rxImg && <a href={rxImg} target="_blank" rel="noreferrer" className="shrink-0"><img src={rxImg} alt="Prescription hard copy" className="h-16 w-16 rounded-lg border border-navy-100 bg-white object-cover" /></a>}
            {!rxImg && !d.rx_consent && <span className="shrink-0 rounded-lg border border-dashed border-rose-300 px-2 py-1 text-[10px] text-rose-500">No photo</span>}
          </div>
        </div>}
        {d.kind === "order" && events.length > 0 && (
          <div className="card p-4 text-sm">
            <p className="mb-3 font-semibold">Status history</p>
            <div className="space-y-2.5">
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium capitalize text-navy-800">{(e.from_status ? `${e.from_status} → ` : "") + e.to_status?.replace("_", " ")}{e.note ? ` — ${e.note}` : ""}</p>
                    <p className="text-[11px] text-slate-400">{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                </div>))}
            </div>
          </div>)}
        {d.payments?.length > 0 && <div><p className="mb-1 text-sm font-semibold">Payments</p>{d.payments.map((p: any) => <p key={p.id} className="flex justify-between text-sm"><span className="capitalize">{p.method}{p.reference ? ` | ${p.reference}` : ""} <span className="text-slate-400">{new Date(p.created_at).toLocaleDateString("en-IN")}</span></span><span>{inr(p.amount)}</span></p>)}</div>}
        {d.notes && <p className="text-sm text-slate-600">Note: {d.notes}</p>}
      </div>
      <div className="space-y-3"><div className="card space-y-1 p-4 text-sm"><p className="flex justify-between"><span className="text-slate-500">Subtotal</span>{inr(d.subtotal)}</p>{Number(d.discount_total) > 0 && <p className="flex justify-between text-rose-600"><span>Discount</span>-{inr(d.discount_total)}</p>}
        {d.gst_applied && Number(d.cgst_total) > 0 && <><p className="flex justify-between text-xs text-slate-500"><span>Taxable</span>{d.taxable_total ? inr(Number(d.taxable_total)) : "-"}</p><p className="flex justify-between text-xs text-slate-500"><span>CGST</span>{inr(Number(d.cgst_total))}</p><p className="flex justify-between text-xs text-slate-500"><span>SGST</span>{inr(Number(d.sgst_total))}</p></> }
        {d.gst_applied && Number(d.igst_total) > 0 && <p className="flex justify-between text-xs text-slate-500"><span>IGST</span>{inr(Number(d.igst_total))}</p>}
        {d.gst_applied && <p className="flex justify-between text-xs text-slate-500"><span>GST included</span>{inr(d.tax_included)}</p>}<p className="flex justify-between text-lg font-bold"><span>Total</span>{inr(d.grand_total)}</p>
        {d.kind === "order" && <><p className="flex justify-between"><span className="text-slate-500">Paid</span>{inr(d.paid_total)}</p><p className="flex justify-between font-semibold"><span>Balance</span>{inr(bal)}</p></>}</div>
        <a href={`/print/sale/${d.id}`} target="_blank" className="btn btn-primary w-full"><Printer size={16} />Print A5</a>
        <WhatsAppSend phone={phone}
          keys={d.kind === "quotation"
            ? ["quotation_share"]
            : ["order_confirmed", "order_in_progress", "order_qc", "order_ready", "order_delivered", "order_cancelled", "balance_due"]}
          vars={{
            Name: c.full_name,
            Item: [...d.sale_lines].sort((a: any, b: any) => a.line_no - b.line_no).map((l: any) => l.description).filter(Boolean).join(", ") || "your order",
            Code: d.code,
            Amount: inr(d.grand_total),
            "Valid Till": new Date(d.valid_until).toLocaleDateString("en-IN"),
            Balance: inr(bal),
            Store: d.branches?.name ?? "",
          }}
          defaultKey={d.kind === "quotation" ? "quotation_share" : WA_DEFAULT[status] ?? "order_confirmed"}
          onSent={() => { if (d.kind === "quotation") markSent(d.id); }} />
        {d.kind === "order" && bal > 0 && d.status !== "cancelled" && <button onClick={() => { setPay({ amount: String(bal), method: "cash", reference: "" }); setPayOpen(true); }} className="btn btn-gold w-full"><Wallet size={16} />Add payment</button>}
        {d.kind === "order" && d.status === "ready" && <button disabled={busy} onClick={() => run(() => deliverOrder(d.id))} className="btn btn-ghost w-full"><CheckCircle2 size={16} />Mark delivered</button>}
        {d.kind === "order" && !["cancelled"].includes(d.status) && <a href={`/finance?cn=${d.id}`} className="btn btn-ghost w-full text-rose-600 text-sm" onClick={() => onClose()}>Issue credit note / return</a>}
        {d.kind === "order" && ["lab_pending", "ready"].includes(d.status) && <button disabled={busy} onClick={() => confirm("Cancel this order and return the stock?") && run(() => cancelOrder(d.id))} className="btn btn-ghost w-full text-rose-600"><Ban size={16} />Cancel order</button>}
        {d.kind === "quotation" && ["draft", "sent"].includes(d.status) && (status === "expired" ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">This quotation has expired. Create a fresh one with current prices.</p> : <button onClick={() => onConvert(d)} className="btn btn-gold w-full"><ArrowRightLeft size={16} />Convert to order</button>)}
      </div></div></Modal>
    <Drawer open={payOpen} onClose={() => setPayOpen(false)} title="Add payment" subtitle={`${d.code} | balance ${inr(bal)}`} footer={<><button onClick={() => setPayOpen(false)} className="btn btn-ghost">Cancel</button>
      <button disabled={busy} className="btn btn-gold" onClick={async () => { await run(() => addPayment({ sale_id: d.id, amount: Number(pay.amount), method: pay.method, reference: pay.reference })); setPayOpen(false); }}>Save payment</button></>}>
      <div className="space-y-3"><input className="field" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder="Amount" />
        <select className="field" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{["cash", "upi", "card", "bank"].map((m) => <option key={m}>{m}</option>)}</select>
        {pay.method !== "cash" && <input className="field" placeholder="Reference / transaction ID" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />}</div></Drawer></>);
}

export function SalesView(props: any) {
  const { sales } = props; const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState<"order" | "quotation">("order"); const [q, setQ] = useState(""); const [pos, setPos] = useState<null | { customerId?: string; quotation?: any }>(null); const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { if (sp.get("new")) setPos({ customerId: sp.get("customer") ?? undefined }); }, [sp]);
  const rows = sales.filter((s: any) => s.kind === tab && `${s.code} ${s.customers?.full_name} ${s.customers?.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (<div className="mx-auto max-w-6xl space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="font-display text-3xl font-semibold">POS & Orders</h1><p className="text-slate-500">Quotations, orders and payments in one place</p></div>
      <button onClick={() => setPos({})} className="btn btn-primary"><Plus size={16} />New sale</button></div>
    <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm sm:w-fit">{([["order", "Orders"], ["quotation", "Quotations"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`relative flex-1 rounded-xl px-5 py-2 text-sm font-medium ${tab === k ? "text-white" : "text-slate-600"}`}>
      {tab === k && <motion.span layoutId="saletab" className="absolute inset-0 rounded-xl bg-navy-800" />}<span className="relative">{l} {sales.filter((s: any) => s.kind === k).length}</span></button>)}</div>
    <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className="field pl-9" placeholder="Search by number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {rows.length === 0 ? <div className="card p-10 text-center text-slate-500"><ShoppingCart className="mx-auto mb-2" />Nothing here yet. Start a new sale.</div> :
      <div className="card divide-y divide-slate-100 overflow-hidden">{rows.map((s: any) => { const st = eff(s); return (
        <button key={s.id} onClick={() => setOpenId(s.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-navy-50">
          <span className="min-w-0 flex-1"><span className="block font-semibold">{s.customers?.full_name} <span className="font-normal text-slate-500">{s.code}</span></span><span className="block text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}{s.kind === "order" && Number(s.grand_total) > Number(s.paid_total) ? ` | due ${inr(Number(s.grand_total) - Number(s.paid_total))}` : ""}</span></span>
          <span className="hidden font-semibold sm:block">{inr(s.grand_total)}</span>{s.kind === "order" && <Pill tone={TONE[s.payment_status]}>{s.payment_status}</Pill>}<Pill tone={TONE[st]}>{label(st)}</Pill></button>); })}</div>}
    <AnimatePresence>{pos && <Pos key="pos" {...props} preset={pos} onClose={() => setPos(null)} onDone={(id: string) => { setPos(null); router.refresh(); setOpenId(id); }} />}</AnimatePresence>
    <Detail id={openId} onClose={() => setOpenId(null)} onConvert={(d) => { setOpenId(null); setPos({ quotation: d }); }} />
  </div>);
}
