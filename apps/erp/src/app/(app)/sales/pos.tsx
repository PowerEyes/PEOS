"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Drawer, useToast } from "@poweros/ui";
import { Camera, FileCheck2, Glasses, Minus, Plus, ScanBarcode, Search, ShoppingBag, Trash2, X, UserRound } from "lucide-react";
import { ctaFor, dbError, fmt, inr, stockState } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { imgUrl, shrink } from "@/lib/image";
import { CameraScanner } from "@/components/CameraScanner";
import { QuickCustomer } from "@/components/QuickCustomer";
import { PosRxDrawer } from "./rx-drawer";
import { placeSale } from "./actions";

type Line = { key: string; line_type: "product" | "accessory" | "lens" | "service"; product_id?: string; lens_package_id?: string; option_ids?: string[]; description: string; details?: string; qty: number; unit_price: number; discount_pct: number; tax_pct: number };
const r2 = (n: number) => Math.round(n * 100) / 100; const lt = (l: Line) => r2(l.qty * l.unit_price * (1 - l.discount_pct / 100));
const uid = () => Math.random().toString(36).slice(2);
function useDesktop() { const [d, setD] = useState(false); useEffect(() => { const m = window.matchMedia("(min-width:1024px)"); const f = () => setD(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []); return d; }
const FILTERS = [["", "All"], ["frame", "Frames"], ["sunglass", "Sunglasses"], ["contact_lens", "Contact lenses"], ["accessory", "Accessories"]];

function LensPicker({ open, onClose, packages, options, rx, onPick }: any) {
  const [pid, setPid] = useState(""); const [idx, setIdx] = useState(""); const [adds, setAdds] = useState<string[]>([]);
  const pkg = packages.find((p: any) => p.id === pid); const fits = (o: any) => !o.designs?.length || (pkg && o.designs.includes(pkg.design));
  const idxOpts = options.filter((o: any) => o.grp === "index" && fits(o)); const addOpts = options.filter((o: any) => o.grp === "addon" && fits(o));
  useEffect(() => { if (open) { setPid(packages[0]?.id ?? ""); setAdds([]); } }, [open]);
  useEffect(() => { setIdx(idxOpts[0]?.id ?? ""); setAdds((a) => a.filter((id) => addOpts.some((o: any) => o.id === id))); }, [pid]);
  const chosen = [idx, ...adds].filter(Boolean).map((id) => options.find((o: any) => o.id === id)).filter(Boolean);
  const total = pkg ? Number(pkg.base_price) + chosen.reduce((a: number, o: any) => a + Number(o.price), 0) : 0;
  const out = pkg && rx && ["od", "os"].some((s) => { const sp = rx[`${s}_sph`], cy = rx[`${s}_cyl`]; return (sp != null && pkg.sph_min != null && sp < pkg.sph_min) || (sp != null && pkg.sph_max != null && sp > pkg.sph_max) || (cy != null && pkg.cyl_max != null && Math.abs(cy) > pkg.cyl_max); });
  const nearAdd = pkg && rx && (rx.od_add || rx.os_add) && pkg.design === "single_vision";
  const Row = ({ o, on, set, radio }: any) => (<button type="button" onClick={set} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:bg-slate-50"}`}>
    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2 ${radio ? "rounded-full" : "rounded"} ${on ? "border-gold-500 bg-gold-500 text-white" : "border-slate-300"}`}>{on && <span className="text-[10px]">&#10003;</span>}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{o.name} {o.badge && <span className="ml-1 rounded bg-amber-200 px-1.5 text-[10px] text-amber-900">{o.badge}</span>}</span><span className="block text-xs text-slate-500">{o.description}</span></span>
    <span className="text-sm font-semibold">{Number(o.price) > 0 ? `+${inr(o.price)}` : "Included"}</span></button>);
  return (<Drawer open={open} onClose={onClose} title="Choose lenses" subtitle={rx ? `Prescription ${rx.rx_code}` : "No prescription selected"}
    footer={<><button onClick={onClose} className="btn btn-ghost">Frame only</button><button disabled={!pkg} onClick={() => { onPick({ lens_package_id: pkg.id, option_ids: chosen.map((o: any) => o.id), description: `${pkg.name} lenses${chosen[0] && chosen[0].grp === "index" ? ` ${chosen[0].name.split(" ")[0]}` : ""}`, details: chosen.map((o: any) => o.name).join(", "), unit_price: total, tax_pct: Number(pkg.tax_pct) }); onClose(); }} className="btn btn-gold">Add lenses | {inr(total)}</button></>}>
    <div className="space-y-5">
      {packages.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm">No active lens packages. Add one in Inventory, Lens packages.</p>}
      <div className="space-y-2"><p className="font-semibold">1. Lens package</p>{packages.map((p: any) => <Row key={p.id} radio on={pid === p.id} set={() => setPid(p.id)} o={{ name: p.name, description: `${p.design.replace("_", " ")}${p.short_desc ? ` | ${p.short_desc}` : ""}`, price: p.base_price }} />)}</div>
      {out && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">This prescription is outside the range of the {pkg.name} package. Pick a package that supports the power.</p>}
      {nearAdd && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This prescription has a near ADD. Consider a progressive or bifocal package.</p>}
      {idxOpts.length > 0 && <div className="space-y-2"><p className="font-semibold">2. Lens index</p>{idxOpts.map((o: any) => <Row key={o.id} radio on={idx === o.id} set={() => setIdx(o.id)} o={o} />)}</div>}
      {addOpts.length > 0 && <div className="space-y-2"><p className="font-semibold">3. Add-ons (optional)</p>{addOpts.map((o: any) => <Row key={o.id} on={adds.includes(o.id)} set={() => setAdds(adds.includes(o.id) ? adds.filter((x) => x !== o.id) : [...adds, o.id])} o={o} />)}</div>}
    </div></Drawer>);
}

export function Pos({ products, customers, branches, packages, options, quoteDays, gst, preset, onClose, onDone }: any) {
  const [extraC, setExtraC] = useState<any[]>([]); const [qc, setQc] = useState(false);
  const toast = useToast(); const desktop = useDesktop(); const q0 = preset?.quotation;
  const cookieBranch = typeof document !== "undefined" ? document.cookie.match(/branch=([^;]+)/)?.[1] : undefined;
  const [supplyType, setSupplyType] = useState<"intrastate"|"interstate">("intrastate");
  const [recipientGstin, setRecipientGstin] = useState("");
  const [mode, setMode] = useState<"quotation" | "order">(q0 ? "order" : "order"); const [custId, setCustId] = useState<string>(q0?.customer_id ?? preset?.customerId ?? ""); const [cq, setCq] = useState("");
  const [rxList, setRxList] = useState<any[]>([]); const [rxId, setRxId] = useState<string>(q0?.prescription_id ?? ""); const [branchId, setBranchId] = useState<string>(q0?.branch_id ?? cookieBranch ?? branches[0]?.id ?? "");
  const [rxOpen, setRxOpen] = useState(false); const [rxConsent, setRxConsent] = useState(false);
  const [lines, setLines] = useState<Line[]>([]); const [q, setQ] = useState(""); const [kf, setKf] = useState(""); const [cam, setCam] = useState(false); const [lens, setLens] = useState(false); const [cart, setCart] = useState(false);
  const [payAmt, setPayAmt] = useState(""); const [method, setMethod] = useState("cash"); const [ref, setRef] = useState(""); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(new Date(Date.now() + quoteDays * 86400000).toISOString().slice(0, 10)); const [svc, setSvc] = useState({ open: false, name: "", price: "" });
  const stockAt = (p: any) => p.stock?.find((s: any) => s.branch_id === branchId)?.qty ?? 0;
  const allC = [...extraC, ...customers]; const cust = allC.find((c: any) => c.id === custId); const rx = rxList.find((r) => r.id === rxId) ?? null;

  useEffect(() => { if (!q0) return; setLines((q0.sale_lines ?? []).sort((a: any, b: any) => a.line_no - b.line_no).map((l: any) => {
    const pr = l.product_id ? products.find((p: any) => p.id === l.product_id) : null; const pk = l.lens_package_id ? packages.find((p: any) => p.id === l.lens_package_id) : null;
    const optSum = (l.option_ids ?? []).reduce((a: number, id: string) => a + Number(options.find((o: any) => o.id === id)?.price ?? 0), 0);
    return { key: uid(), line_type: l.line_type, product_id: l.product_id ?? undefined, lens_package_id: l.lens_package_id ?? undefined, option_ids: l.option_ids, description: l.description, details: l.details ?? undefined, qty: l.qty,
      unit_price: pr ? Number(pr.selling_price) : pk ? Number(pk.base_price) + optSum : Number(l.unit_price), discount_pct: Number(l.discount_pct), tax_pct: Number(l.tax_pct) }; })); }, []);
  useEffect(() => { if (!custId) { setRxList([]); return; }
    supabaseBrowser().from("prescriptions").select("id, rx_code, rx_date, valid_till, image_path, source, external_practice, od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add").eq("customer_id", custId).order("rx_date", { ascending: false })
      .then(({ data }) => { setRxList(data ?? []); setRxId((cur) => cur && (data ?? []).some((r) => r.id === cur) ? cur : data?.[0]?.id ?? ""); }); }, [custId]);

  const sub = lines.reduce((a, l) => a + l.qty * l.unit_price, 0), total = lines.reduce((a, l) => a + lt(l), 0), taxInc = gst ? lines.reduce((a, l) => a + lt(l) - r2(lt(l) / (1 + l.tax_pct / 100)), 0) : 0;
  const hasLens = lines.some((l) => l.line_type === "lens"); const paying = Number(payAmt || 0);
  // Hard-copy gate: orders only (quotations skip), and only when a prescription
  // is involved (lens line, power-eligible item, or an attached Rx).
  const powerLine = lines.some((l) => !!l.product_id && products.find((p: any) => p.id === l.product_id)?.power_eligible);
  const rxInvolved = hasLens || powerLine || !!rxId;
  const gateActive = mode === "order" && rxInvolved;
  const rxHasImage = !!rx?.image_path;
  const gateOk = !gateActive || rxHasImage || rxConsent;
  const shown = useMemo(() => products.filter((p: any) => (!kf || p.kind === kf) && `${p.brands?.name ?? ""} ${p.model} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [products, kf, q]);
  const upd = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function add(p: any) {
    if (mode === "order" && stockAt(p) <= 0) return toast("Out of stock at this branch", "err");
    const ex = lines.find((l) => l.product_id === p.id);
    if (ex) { if (mode === "order" && ex.qty + 1 > stockAt(p)) return toast(`Only ${stockAt(p)} in stock here`, "err"); upd(ex.key, { qty: ex.qty + 1 }); }
    else setLines((ls) => [...ls, { key: uid(), line_type: p.kind === "accessory" ? "accessory" : "product", product_id: p.id, description: `${p.brands?.name ?? ""} ${p.model}`.trim(), qty: 1, unit_price: Number(p.selling_price), discount_pct: 0, tax_pct: Number(p.tax_pct) }]);
    if (p.power_eligible && !ex) setLens(true); else toast("Added to bag");
  }
  const byCode = (code: string) => { const p = products.find((x: any) => x.barcode === code.trim() || x.sku === code.trim().toUpperCase()); if (p) { add(p); setQ(""); } else setQ(code); };

  async function submit() {
    if (!custId) return toast("Choose a customer first", "err"); if (lines.length === 0) return toast("The bag is empty", "err");
    if (mode === "order" && hasLens && !rxId) return toast("Lens orders need a prescription", "err");
    if (!gateOk) return toast("Prescription hard copy or recorded consent is required for this order", "err");
    if (paying > total) return toast("Payment is more than the total", "err");
    setBusy(true);
    let r: any;
    try { r = await placeSale({ kind: mode, customer_id: custId, branch_id: branchId, supply_type: supplyType, recipient_gstin: recipientGstin || undefined, prescription_id: rxId || null, quotation_id: q0?.id, notes, valid_until: mode === "quotation" ? valid : undefined,
      rx_consent: gateActive && rxConsent && !rxHasImage,
      idempotency_key: crypto.randomUUID(),
      lines: lines.map(({ key, ...x }) => x), payment: mode === "order" && paying > 0 ? { amount: paying, method, reference: ref } : undefined }); }
    catch (e: any) { setBusy(false); return toast(e?.message ?? "Sale failed", "err"); }
    setBusy(false); if (!r || r.error) return toast((r && r.error) || "Sale failed", "err"); toast(`${r.ok ?? "Sale"} created`); onDone(r.id!);
  }

  async function attachHardCopy(files: FileList | null) {
    const f = files?.[0]; if (!f || !rxId) return;
    try {
      const sb = supabaseBrowser();
      const { data: { user: u } } = await sb.auth.getUser(); const { data: p } = await sb.from("profiles").select("org_id").eq("id", u?.id ?? "").single();
      const path = `${p?.org_id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("prescriptions").upload(path, await shrink(f), { contentType: "image/jpeg" });
      if (error) return toast(dbError(error.message), "err");
      const { error: e2 } = await sb.from("prescriptions").update({ image_path: path }).eq("id", rxId);
      if (e2) return toast(e2.message, "err");
      setRxList((list) => list.map((r) => (r.id === rxId ? { ...r, image_path: path } : r)));
      toast("Hard copy attached to this prescription");
    } catch { toast("Could not read that image", "err"); }
  }

  // Hard-copy gate panel — shown in the bag footer for prescription-involved orders.
  const gatePanel = gateActive && (
    <div className={`rounded-xl border p-3 ${rxHasImage ? "border-emerald-200 bg-emerald-50" : rxConsent ? "border-amber-300 bg-amber-50" : "border-rose-300 bg-rose-50"}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600"><FileCheck2 size={13} />Prescription hard copy</p>
      {rxHasImage ? (
        <p className="mt-1.5 text-xs text-emerald-700">✓ Hard copy photo on file {rx ? `(${rx.rx_code})` : ""}.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">{rx ? `Prescription ${rx.rx_code} has no hard-copy photo.` : "No prescription attached."} Attach the customer's paper Rx, or record their consent to proceed without one.</p>
          {rx && (
            <label className="btn btn-ghost w-full !py-1.5 text-xs cursor-pointer">
              <Camera size={14} />Attach hard copy photo
              <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => attachHardCopy(e.target.files)} />
            </label>)}
          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={rxConsent} onChange={(e) => setRxConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-navy-700" />
            <span>Customer has <b>no paper prescription</b> — consent recorded to proceed without a hard copy.</span>
          </label>
        </div>
      )}
    </div>);

  const cartBody = (<div className="flex h-full flex-col">
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {lines.length === 0 && <div className="grid place-items-center py-16 text-center text-slate-500"><ShoppingBag className="mb-2" size={36} />The bag is empty.<br />Tap a product to add it.</div>}
      {lines.map((l) => (<motion.div layout key={l.key} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-slate-100 p-3">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{l.description}</p>{l.details && <p className="text-xs text-slate-500">{l.details}</p>}</div>
          <button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove"><Trash2 size={15} className="text-rose-500" /></button></div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {l.line_type === "lens" ? <span className="text-xs text-slate-500">1 pair</span> : <div className="flex items-center gap-1 rounded-lg border border-slate-200"><button className="p-1.5" onClick={() => upd(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus size={14} /></button><span className="w-6 text-center text-sm">{l.qty}</span>
            <button className="p-1.5" onClick={() => { const p = products.find((x: any) => x.id === l.product_id); if (p && mode === "order" && l.qty + 1 > stockAt(p)) return toast(`Only ${stockAt(p)} in stock here`, "err"); upd(l.key, { qty: l.qty + 1 }); }}><Plus size={14} /></button></div>}
          <label className="flex items-center gap-1 text-xs text-slate-500">Disc %<input type="number" min={0} max={100} value={l.discount_pct || ""} onChange={(e) => upd(l.key, { discount_pct: Math.min(100, Math.max(0, Number(e.target.value))) })} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm text-navy-900" /></label>
          <p className="font-semibold">{inr(lt(l))}</p></div></motion.div>))}
      {lines.length > 0 && !hasLens && <button onClick={() => setLens(true)} className="btn btn-ghost w-full"><Glasses size={16} />Add lenses</button>}
      <button onClick={() => setSvc({ ...svc, open: true })} className="w-full text-center text-sm text-navy-700 underline">Add a service (repair, eye test, warranty)</button>
      {svc.open && <div className="flex gap-2"><input className="field py-2" placeholder="Service name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} /><input className="field w-28 py-2" inputMode="decimal" placeholder="Price" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} />
        <button className="btn btn-primary !px-3" onClick={() => { if (!svc.name || !(Number(svc.price) >= 0)) return; setLines((ls) => [...ls, { key: uid(), line_type: "service", description: svc.name, qty: 1, unit_price: Number(svc.price), discount_pct: 0, tax_pct: gst ? 18 : 0 }]); setSvc({ open: false, name: "", price: "" }); }}>Add</button></div>}
    </div>
    <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4 text-sm">
      <div className="space-y-1"><p className="flex justify-between"><span className="text-slate-500">Subtotal</span>{inr(r2(sub))}</p>{sub - total > 0.005 && <p className="flex justify-between text-rose-600"><span>Discount</span>-{inr(r2(sub - total))}</p>}
        {gst && <p className="flex justify-between text-xs text-slate-500"><span>GST included</span>{inr(r2(taxInc))}</p>}<p className="flex justify-between text-xl font-bold"><span>Total</span>{inr(r2(total))}</p></div>
      {mode === "quotation" ? <label className="block"><span className="text-xs text-slate-500">Valid until</span><input type="date" className="field py-2" value={valid} onChange={(e) => setValid(e.target.value)} /></label> : <div className="space-y-2">
        <div className="flex gap-2">{[["Full", total], ["Half", total / 2], ["None", 0]].map(([l, v]: any) => <button key={l} onClick={() => setPayAmt(v ? String(r2(v)) : "")} className="btn btn-ghost flex-1 !py-1.5 text-xs">{l}</button>)}</div>
        <div className="grid grid-cols-2 gap-2"><input className="field py-2" inputMode="decimal" placeholder="Paying now" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
          <select className="field py-2" value={method} onChange={(e) => setMethod(e.target.value)}>{["cash", "upi", "card", "bank"].map((m) => <option key={m}>{m}</option>)}</select></div>
        {method !== "cash" && <input className="field py-2" placeholder="Reference / transaction ID" value={ref} onChange={(e) => setRef(e.target.value)} />}
        <p className="flex justify-between font-medium"><span>Balance</span><span>{inr(r2(Math.max(0, total - paying)))}</span></p></div>}
      <input className="field py-2" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {gatePanel}
      <button disabled={busy || !gateOk} onClick={submit} className="btn btn-gold w-full !py-3 text-base disabled:opacity-50">{busy ? "Saving…" : mode === "order" ? `Place order | ${inr(r2(total))}` : "Save quotation"}</button></div></div>);

  return (<motion.div className="fixed inset-0 z-50 flex flex-col bg-canvas" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 300 }}>
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4 sm:py-3 sm:gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 shrink-0 hover:bg-slate-200"><X size={16} /></button>
        <h2 className="font-display text-lg sm:text-xl font-semibold truncate">{q0 ? `Convert ${q0.code}` : "New sale"}</h2>
      </div>
      <div className="relative ml-auto flex rounded-xl bg-slate-100 p-1 shrink-0">{(["order", "quotation"] as const).map((m) => <button key={m} disabled={!!q0} onClick={() => setMode(m)} className={`relative rounded-lg px-2.5 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-medium capitalize ${mode === m ? "text-white" : "text-slate-600"}`}>
        {mode === m && <motion.span layoutId="mode" className="absolute inset-0 rounded-lg bg-navy-800" />}<span className="relative">{m}</span></button>)}</div>
      <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="field hidden w-auto py-2 sm:block">{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><button type="button" onClick={()=>setSupplyType(s=>s==="intrastate"?"interstate":"intrastate")} className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium ${supplyType==="interstate"?"border-amber-400 bg-amber-50 text-amber-800":"border-slate-200"}`}>{supplyType==="intrastate"?"Intra-state":"Inter-state (IGST)"}</button></header>
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4 pb-28">
        <div className="card space-y-3 p-4">
          {cust ? <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-navy-800 text-white">{cust.full_name[0]}</span><div><p className="font-semibold">{cust.full_name}</p><p className="text-xs text-slate-500">{cust.vision_id} | {cust.phone}</p></div></div>
            {!q0 && <button onClick={() => setCustId("")} className="text-sm text-navy-700 underline">Change</button>}</div> :
            <div><div className="relative"><UserRound size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className="field pl-9" placeholder="Find the customer by name, phone or Vision ID" value={cq} onChange={(e) => setCq(e.target.value)} /></div>
              <div className="mt-2 space-y-1">{cq.length > 1 && allC.filter((c: any) => `${c.full_name} ${c.phone} ${c.vision_id}`.toLowerCase().includes(cq.toLowerCase())).slice(0, 5).map((c: any) => <button key={c.id} onClick={() => setCustId(c.id)} className="flex w-full justify-between rounded-xl border border-slate-100 px-4 py-2.5 text-left text-sm hover:bg-navy-50"><b>{c.full_name}</b><span className="text-slate-500">{c.phone}</span></button>)}
                <button onClick={() => setQc(true)} className="btn btn-ghost !py-2 text-sm"><Plus size={14} />New customer</button></div></div>}
          {cust && <div><p className="mb-1 text-xs text-slate-500">Prescription {hasLens && mode === "order" && <span className="text-rose-600">(required for lenses)</span>}</p>
            <div className="flex flex-wrap gap-2">{rxList.map((r) => <button key={r.id} onClick={() => setRxId(r.id)} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${rxId === r.id ? "border-gold-500 bg-amber-50" : "border-slate-200"}`}><b>{r.rx_code}</b> {new Date(r.rx_date).toLocaleDateString("en-IN")}<br />OD {fmt(r.od_sph)} {fmt(r.od_cyl)} | OS {fmt(r.os_sph)} {fmt(r.os_cyl)}</button>)}
              <button onClick={() => setRxId("")} className={`rounded-xl border px-3 py-2 text-xs ${rxId === "" ? "border-gold-500 bg-amber-50" : "border-slate-200"}`}>None</button>
              <button onClick={() => setRxOpen(true)} className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-navy-700">+ New Rx</button></div></div>}
        </div>
        <div className="space-y-3"><div className="flex gap-2"><div className="relative flex-1"><ScanBarcode size={16} className="absolute left-3 top-3.5 text-gold-500" />
          <input className="field pl-9" placeholder="Search, or scan and press Enter" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && byCode(q)} /></div>
          <button onClick={() => setCam(true)} className="btn btn-ghost" aria-label="Scan with camera"><Camera size={18} /></button></div>
          <div className="flex gap-2 overflow-x-auto">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setKf(k)} className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${kf === k ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white"}`}>{l}</button>)}</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{shown.map((p: any) => { const st = stockAt(p); const out = mode === "order" && st <= 0; return (
            <motion.button whileTap={{ scale: .97 }} key={p.id} disabled={out} onClick={() => add(p)} className={`card overflow-hidden text-left transition ${out ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-lg"}`}>
              <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-navy-50 to-white">{p.images?.[0] ? <img src={imgUrl(p.images[0])} alt="" className="h-full w-full object-contain p-2" /> : <Glasses className="text-slate-300" size={32} />}</div>
              <div className="p-2.5"><p className="truncate text-xs text-slate-500">{p.brands?.name} | {st} here</p><p className="truncate text-sm font-semibold">{p.model}</p><div className="mt-1 flex items-center justify-between"><span className="font-bold">{inr(p.selling_price)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.power_eligible ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{stockState(st, 0) === "out" && mode === "order" ? "Out of stock" : ctaFor(p)}</span></div></div></motion.button>); })}</div>
          {shown.length === 0 && <p className="card p-8 text-center text-slate-500">No products match.</p>}</div>
      </div>
      {desktop && <aside className="w-[400px] shrink-0 border-l border-slate-100 bg-white">{cartBody}</aside>}
    </div>
    {!desktop && <button onClick={() => setCart(true)} className="fixed inset-x-4 bottom-4 z-10 flex items-center justify-between rounded-2xl bg-navy-800 px-5 py-4 font-semibold text-white shadow-2xl"><span className="flex items-center gap-2"><ShoppingBag size={18} />Bag ({lines.reduce((a, l) => a + l.qty, 0)})</span><span>{inr(r2(total))}</span></button>}
    {!desktop && <Drawer open={cart} onClose={() => setCart(false)} title="Bag">{<div className="-mx-4 -my-4 sm:-mx-6 sm:-my-5 h-[calc(100dvh-75px)]">{cartBody}</div>}</Drawer>}
    <LensPicker open={lens} onClose={() => setLens(false)} packages={packages} options={options} rx={rx} onPick={(l: any) => { setLines((ls) => [...ls, { key: uid(), line_type: "lens", qty: 1, discount_pct: 0, ...l }]); toast("Lenses added"); }} />
    <PosRxDrawer open={rxOpen} onClose={() => setRxOpen(false)} customerId={custId}
      onCreated={(r) => { setRxList((list) => [r, ...list.filter((x) => x.id !== r.id)]); setRxId(r.id); setRxConsent(false); }} />
    <QuickCustomer open={qc} onClose={() => setQc(false)} onCreated={(c, rxId) => { setExtraC((x) => [c, ...x]); setCustId(c.id); setCq(""); setQc(false); toast(`${c.full_name} added`); if (rxId) setRxId(rxId); }} />
    <CameraScanner open={cam} onClose={() => setCam(false)} onResult={byCode} />
  </motion.div>);
}
