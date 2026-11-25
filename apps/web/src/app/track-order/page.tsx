
"use client";
import { useState } from "react";
import { useSite } from "@/lib/site-context";
import Link from "next/link";
import { Search, Package, Check, Clock, Truck, MapPin, Phone, ChevronRight } from "lucide-react";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const STATUS_STEPS = [
  { key:"draft",       label:"Order Placed",      icon:Check },
  { key:"processing",  label:"Being Prepared",    icon:Clock },
  { key:"lab_pending", label:"At Lab",            icon:Package },
  { key:"in_workshop", label:"In Workshop",       icon:Package },
  { key:"qc",          label:"Quality Check",     icon:Check },
  { key:"ready",       label:"Ready for Pickup",  icon:Package },
  { key:"delivered",   label:"Delivered",         icon:Truck },
];
const STEP_ORDER = ["draft","processing","lab_pending","in_workshop","qc","ready","delivered"];
const STATUS_COLOR: Record<string,string> = {
  delivered:"bg-emerald-500 text-white", ready:"bg-emerald-500 text-white",
  in_workshop:"bg-violet-500 text-white", lab_pending:"bg-violet-500 text-white",
  processing:"bg-amber-500 text-white", qc:"bg-orange-500 text-white",
  cancelled:"bg-rose-500 text-white", draft:"bg-slate-400 text-white",
};
const inr = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

export default function TrackOrderPage() {
  const site = useSite();
  const { whatsappNumber } = useSite();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState<any>(null);

  async function track(e: React.FormEvent) {
    e.preventDefault();
    setOrder(null); setErr("");
    const normalizedPhone = phone.trim().replace(/\D/g, "");
    if (!code.trim() || normalizedPhone.length !== 10) {
      setErr("Enter your order number and a valid 10-digit registered phone number.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/track-order?code=${encodeURIComponent(code.trim().toUpperCase())}&phone=${encodeURIComponent(normalizedPhone)}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) setErr(d.error || "Order not found. Please check your order number and phone number.");
      else setOrder(d);
    } catch { setErr("Something went wrong. Please check your connection and try again."); }
    finally { setBusy(false); }
  }

  const st = order?.status ?? "draft";
  const currentStepIdx = STEP_ORDER.indexOf(st);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500 flex items-center gap-1">
        <Link href="/" className="hover:underline">Home</Link><ChevronRight size={11}/><span className="font-medium text-slate-700">Track Order</span>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-7 py-10 text-center">
          <Truck size={40} className="mx-auto mb-4 text-gold-400"/>
          <h1 className="font-extrabold text-3xl">Track Your Order</h1>
          <p className="text-slate-300 mt-2">Enter your order number and registered phone number to see your order status — no login required.</p>
        </div>

        {/* Track form */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
          <form onSubmit={track} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-navy-900 mb-1.5 block">Order Number *</span>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. ORD-0001 or PE10234" required
                className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-mono outline-none focus:border-navy-700 uppercase tracking-wide"/>
              <p className="text-xs text-slate-400 mt-1">Found in your order confirmation WhatsApp message or email.</p>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900 mb-1.5 block">Phone Number *</span>
              <div className="flex">
                <span className="flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500 select-none">+91</span>
                <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile number" required maxLength={10}
                  className="flex-1 rounded-r-xl border border-slate-200 px-4 py-3.5 text-sm outline-none focus:border-navy-700"/>
              </div>
              <p className="text-xs text-slate-400 mt-1">The phone number used when placing your order.</p>
            </label>
            {err && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-700">{err}</div>}
            <button disabled={busy} className="w-full rounded-xl bg-navy-800 py-4 text-sm font-bold text-white hover:bg-navy-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              <Search size={16}/>{busy ? "Tracking…" : "Track My Order"}
            </button>
          </form>
        </div>

        {/* Order result */}
        {order && (
          <div className="space-y-4">
            {/* Status header */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Order Number</p>
                  <p className="font-extrabold text-xl text-navy-900">#{order.code}</p>
                  <p className="text-sm text-slate-500 mt-0.5">Placed on {new Date(order.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>
                </div>
                <span className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${STATUS_COLOR[st]||"bg-slate-400 text-white"}`}>
                  {st.replace("_"," ")}
                </span>
              </div>

              {/* Step progress */}
              {st !== "cancelled" && (
                <div className="relative">
                  <div className="absolute left-3.5 top-3 bottom-3 w-px bg-slate-200"/>
                  <div className="space-y-4">
                    {STATUS_STEPS.filter(s=>STEP_ORDER.includes(s.key)).map(s=>{
                      const idx = STEP_ORDER.indexOf(s.key);
                      const done = currentStepIdx >= idx;
                      const current = currentStepIdx === idx;
                      return (
                        <div key={s.key} className="flex items-center gap-4">
                          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 z-10 ${done?"bg-navy-800 border-navy-800 text-white":"bg-white border-slate-200 text-slate-300"}`}>
                            {done?<Check size={13}/>:<s.icon size={13}/>}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${done?"text-navy-900":"text-slate-400"}`}>{s.label}</p>
                            {current&&<p className="text-xs text-gold-600 font-semibold">← Current status</p>}
                          </div>
                        </div>);})}
                  </div>
                </div>)}

              {st === "cancelled" && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  ✗ This order was cancelled. If you paid online, your refund will be processed within 5–7 business days.
                </div>)}

              {order.needs_lab && !["delivered","cancelled"].includes(st) && (
                <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                  🔭 Your prescription lenses are being prepared. We'll WhatsApp you on {phone} when they're ready.
                </div>)}
            </div>

            {/* Order items */}
            {order.lines?.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100"><p className="font-bold text-navy-900 text-sm">Items in this order</p></div>
                <div className="divide-y divide-slate-100">
                  {order.lines.map((l:any,i:number)=>(
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-xl">{l.line_type==="lens"?"🔭":"👓"}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-navy-900 truncate">{l.description}</p><p className="text-xs text-slate-400">Qty: {l.qty}</p></div>
                      <p className="text-sm font-semibold text-navy-900 shrink-0">{inr(l.line_total)}</p>
                    </div>))}
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-sm font-bold">
                  <span className="text-slate-600">Total</span><span className="text-navy-900">{inr(order.grand_total)}</span>
                </div>
              </div>)}

            {/* Contact */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <p className="font-bold text-navy-900 mb-3">Need help with this order?</p>
              <div className="grid grid-cols-2 gap-3">
                <a href={waHref(whatsappNumber, `Status of order ${order.code}`)} target="_blank"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition">💬 WhatsApp</a>
                <a href={`tel:${site.phones[0] ?? ""}`} className="flex items-center justify-center gap-2 rounded-xl border border-navy-800 py-3 text-sm font-bold text-navy-800 hover:bg-navy-50 transition"><Phone size={14}/>Call Us</a>
              </div>
              <p className="text-xs text-slate-400 text-center mt-3">{site.hours} · {site.phones.join(" | ")}</p>
            </div>

            {/* Sign up prompt */}
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-navy-50 to-blue-50 p-5 text-center">
              <p className="font-semibold text-navy-900">Track all orders in one place</p>
              <p className="text-sm text-slate-500 mt-1">Create a free account to see all your orders, prescriptions and appointments.</p>
              <Link href="/my/login" className="mt-3 inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Create Free Account →</Link>
            </div>
          </div>)}
      </div>
      <Footer/>
    </div>);
}

