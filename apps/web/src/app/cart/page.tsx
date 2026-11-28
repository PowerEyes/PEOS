"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { imgUrl, inr } from "@/lib/types";
import { CartSkeleton } from "@/components/Skeletons";
import { useToast } from "@poweros/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Minus, Plus, Trash2, Tag, ArrowRight, ShoppingBag, ChevronRight, Sparkles } from "lucide-react";

const TRUST = ["100% Genuine Products","Easy Returns","Free Adjustments","Secure Payments"];

type CouponRow = { code:string; description:string|null; type:"percent"|"fixed"; value:number; min_order:number };

export default function CartPage() {
  const { state, remove, setQty, applyCoupon, subtotal, total, count, loaded } = useCart();
  const toast = useToast();
  const [couponInput, setCouponInput] = useState(""); const [couponErr, setCouponErr] = useState(""); const [couponOk, setCouponOk] = useState("");
  const [offers, setOffers] = useState<CouponRow[]>([]);
  const [earnRate, setEarnRate] = useState<number|null>(null);
  const [balance, setBalance] = useState<number|null>(null);

  // Active public coupons (RLS lets anon read is_active + in-date rows) plus
  // loyalty earn rate / the signed-in customer's points balance. loyalty_rules
  // becomes publicly readable with migration 0022 — before that the fetch
  // returns nothing and the points block simply hides itself.
  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    (async () => {
      const { data: coupons } = await sb.from("coupons")
        .select("code,description,type,value,min_order")
        .eq("is_active", true).limit(5);
      if (!alive) return;
      setOffers((coupons ?? []) as CouponRow[]);
      const { data: rules } = await sb.from("loyalty_rules").select("earn_rate").limit(1).maybeSingle();
      if (!alive) return;
      if (rules) setEarnRate(Number(rules.earn_rate));
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) return;
        const { data: cust } = await sb.from("customers").select("id").eq("auth_user_id", session.user.id).maybeSingle();
        if (!cust || !alive) return;
        const { data: led } = await sb.from("loyalty_ledger").select("delta").eq("customer_id", cust.id);
        if (alive && led) setBalance(led.reduce((a: number, r: any) => a + Number(r.delta ?? 0), 0));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const earn = earnRate !== null && total > 0 ? Math.floor((total / 100) * earnRate) : null;

  // A bag built before the lens catalogue was scoped to this storefront can
  // still hold a package/option id the checkout API refuses (409 "no longer
  // available"). Drop those lines here so the bag is always checkout-able
  // instead of failing at the payment step.
  const lensKey = state.items
    .filter(i => i.lensPackageId)
    .map(i => `${i.id}:${i.lensPackageId}:${(i.optionIds ?? []).join(",")}`)
    .join("|");
  useEffect(() => {
    if (!loaded || !lensKey) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tenant", { cache: "no-store" });
        if (!res.ok) return;
        const { orgId } = await res.json();
        if (!orgId || !alive) return;
        const sb = supabaseBrowser();
        const [pkgs, opts] = await Promise.all([
          sb.from("lens_packages").select("id").eq("org_id", orgId).eq("status", "active"),
          sb.from("lens_options").select("id").eq("org_id", orgId).eq("status", "active"),
        ]);
        if (!alive || pkgs.error || opts.error) return;
        const validPkg = new Set((pkgs.data ?? []).map(r => r.id));
        const validOpt = new Set((opts.data ?? []).map(r => r.id));
        const gone = state.items.filter(i =>
          i.lensPackageId &&
          (!validPkg.has(i.lensPackageId) || (i.optionIds ?? []).some(o => !validOpt.has(o))));
        if (!gone.length || !alive) return;
        gone.forEach(i => remove(i.id));
        toast(`Removed ${gone.length === 1 ? "an item" : `${gone.length} items`} that are no longer available. Re-add your lenses to continue.`, "err");
      } catch { /* tenant lookup failed — leave the bag alone */ }
    })();
    return () => { alive = false; };
    // `remove`/`toast` are re-created on every render; `lensKey` already tracks
    // the only state this effect cares about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lensKey]);

  async function applyCouponCode(override?: string) {
    const c = (override ?? couponInput).trim().toUpperCase();
    setCouponErr(""); setCouponOk("");
    if (!c) { setCouponErr("Enter a coupon code."); return; }
    try {
      // Server-side validation (dates, min order, usage limits) + discount calc.
      const r = await fetch("/api/coupon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, orderTotal: total }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setCouponErr(d.error || "Invalid or expired coupon code.");
        toast(d.error || "Invalid or expired coupon code.", "err");
        return;
      }
      applyCoupon(d.code, d.discount);
      setCouponOk(d.message || `Coupon ${d.code} applied!`);
      toast(d.message || `Coupon ${d.code} applied!`);
    } catch {
      setCouponErr("Could not verify the coupon. Please try again.");
      toast("Could not verify the coupon.", "err");
    }
  }
  const tax = state.items.reduce((a,i) => a + (i.total - i.total / 1.05), 0);
  // First paint happens before localStorage hydration — skeletons, not a
  // flashing "Your bag is empty" screen.
  if (!loaded) return (
    <div className="min-h-screen bg-white"><Header/>
      <CartSkeleton/>
      <Footer/></div>);
  if (count === 0) return (
    <div className="min-h-screen bg-white"><Header/>
      <div className="mx-auto max-w-lg px-4 py-32 text-center">
        <div className="text-7xl mb-4">🛍️</div>
        <h1 className="font-display text-3xl font-bold text-navy-900">Your bag is empty</h1>
        <p className="mt-2 text-slate-500">Add some frames or lenses to get started</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/eyeglasses" className="btn-gold">Shop Eyeglasses</Link><Link href="/sunglasses" className="btn-navy">Shop Sunglasses</Link></div>
      </div>
      <Footer/></div>);
  return (
    <div className="min-h-screen bg-canvas"><Header/>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-navy-700">Home</Link><ChevronRight size={14}/><span className="font-medium text-navy-900">Cart ({count})</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Items */}
          <div className="space-y-4">
            <AnimatePresence>
              {state.items.map(item => (
                <motion.div key={item.id} layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-40}} className="card flex gap-3 sm:gap-4 p-3 sm:p-4 items-start">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100 flex items-center justify-center overflow-hidden">
                    {item.image ? <img src={imgUrl(item.image)!} alt="" className="h-full w-full object-contain p-2"/> : <span className="text-3xl">👓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">{item.brand}</p>
                    <p className="font-bold text-sm sm:text-base text-navy-900 truncate">{item.productName}</p>
                    {item.lensPackageName && <p className="text-xs text-blue-600 mt-0.5 truncate">+ {item.lensPackageName}{item.addons?.length ? ` | ${item.addons.join(", ")}` : ""}</p>}
                    {item.rx && <p className="text-xs text-slate-400 mt-0.5 truncate">
                      Rx: OD {item.rx.od?.sph ?? "—"} | OS {item.rx.os?.sph ?? "—"}
                      {(item.rx.od?.add != null || item.rx.os?.add != null) && <> | ADD {item.rx.od?.add ?? "—"}/{item.rx.os?.add ?? "—"}</>}
                    </p>}
                    <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white">
                        <button onClick={() => setQty(item.id, item.qty - 1)} className="p-1.5 sm:p-2 hover:bg-slate-50 rounded-l-xl transition" aria-label="Decrease quantity"><Minus size={14}/></button>
                        <span className="w-7 sm:w-8 text-center text-xs sm:text-sm font-semibold">{item.qty}</span>
                        <button onClick={() => setQty(item.id, item.qty + 1)} className="p-1.5 sm:p-2 hover:bg-slate-50 rounded-r-xl transition" aria-label="Increase quantity"><Plus size={14}/></button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm sm:text-base text-navy-900">{inr(item.total)}</span>
                        <button onClick={() => remove(item.id)} className="rounded-lg p-1.5 hover:bg-rose-50 text-rose-500 transition active:scale-95" aria-label="Remove item"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  </div>
                </motion.div>))}
            </AnimatePresence>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {["🎁 Gift wrapping available","📋 Your prescription is saved","🚚 Free pickup from our stores","🔧 Free adjustments included"].map(t =>
                <div key={t} className="rounded-xl bg-white border border-slate-100 px-3 py-2 text-xs text-slate-600">{t}</div>)}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-lg text-navy-900">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal ({count} {count===1?"item":"items"})</span><span>{inr(subtotal)}</span></div>
                {state.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Coupon ({state.coupon})</span><span>-{inr(state.discount)}</span></div>}
                <div className="flex justify-between text-xs text-slate-400"><span>GST included in price</span><span>~{inr(Math.round(tax))}</span></div>
                <div className="flex justify-between text-xs text-slate-400"><span>Shipping</span><span>Free pickup / ₹99 delivery</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-100"><span>Total</span><span className="text-navy-900">{inr(Math.round(total))}</span></div>
              </div>
              {/* Available offers — proactive, from the coupons table */}
              {offers.length > 0 && (
                <div className="rounded-xl border border-gold-100 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold-700">Available offers</p>
                  {offers.map(o => (
                    <div key={o.code} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 leading-snug text-slate-600">
                        <b className="font-mono text-navy-900">{o.code}</b> — {o.description || (o.type === "percent" ? `${o.value}% off` : `${inr(o.value)} off`)}
                        {Number(o.min_order) > 0 && <span className="text-slate-400"> · min {inr(o.min_order)}</span>}
                      </span>
                      <button onClick={() => { setCouponInput(o.code); applyCouponCode(o.code); }} className="shrink-0 rounded-lg border border-gold-300 bg-white px-2.5 py-1 font-semibold text-gold-700 transition hover:bg-gold-50">Apply →</button>
                    </div>))}
                </div>)}
              {/* Coupon */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1"><Tag size={14} className="absolute left-3 top-3 text-slate-400"/><input value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && applyCouponCode()} placeholder="COUPON CODE" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none uppercase focus:border-navy-700"/></div>
                  <button onClick={() => applyCouponCode()} className="rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:border-navy-700 transition">Apply</button>
                </div>
                {couponErr && <p className="text-xs text-rose-600">{couponErr}</p>}
                {couponOk && <p className="text-xs text-emerald-600">✓ {couponOk}</p>}
              </div>
              {/* Loyalty points — balance + earn projection */}
              {(balance !== null || earn !== null) && (
                <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-violet-900"><Sparkles size={13}/> Loyalty points</p>
                  {balance !== null && <p className="mt-1 text-xs text-slate-600">Current balance: <b className="text-violet-900">{balance}</b> points</p>}
                  {earn !== null && <p className="mt-1 text-xs font-semibold text-emerald-700">You&apos;ll earn +{earn} points from this order.</p>}
                </div>)}
              <Link href="/checkout" className="btn-gold w-full py-4 text-base flex items-center justify-center gap-2">Proceed to Checkout <ArrowRight size={16}/></Link>
              <Link href="/eyeglasses" className="text-center block text-sm text-navy-700 underline">Continue shopping</Link>
            </div>
            <div className="card p-4 grid grid-cols-2 gap-2">{TRUST.map(t => <div key={t} className="text-xs text-slate-600 flex items-center gap-1">✓ {t}</div>)}</div>
          </div>
        </div>
      </div>
      <Footer/></div>);
}
