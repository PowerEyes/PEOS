
"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Tag, Eye } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "pe_exit_popup_shown";
const OFFERS = [
  { code:"EYES100",  label:"₹100 OFF",    sub:"on your first order above ₹999" },
  { code:"POWER10",  label:"10% OFF",     sub:"on all eyeglasses — today only" },
];

export function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const offer = OFFERS[Math.floor(Math.random() * OFFERS.length)];

  useEffect(() => {
    // Don't show if already shown in this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    let triggered = false;
    const onMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse exits viewport from the top (classic exit intent)
      if (e.clientY <= 10 && !triggered) {
        triggered = true;
        // Delay 200ms to avoid false positives
        setTimeout(() => setVisible(true), 200);
        sessionStorage.setItem(STORAGE_KEY, "1");
      }
    };
    // Also trigger on mobile after 30 seconds of inactivity
    const timer = setTimeout(() => {
      if (!triggered && !sessionStorage.getItem(STORAGE_KEY)) {
        triggered = true;
        setVisible(true);
        sessionStorage.setItem(STORAGE_KEY, "1");
      }
    }, 30000);

    document.addEventListener("mouseleave", onMouseLeave);
    return () => { document.removeEventListener("mouseleave", onMouseLeave); clearTimeout(timer); };
  }, []);

  function copyCode() {
    navigator.clipboard.writeText(offer.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setVisible(false)}/>
          <motion.div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            initial={{ scale:.85, opacity:0, y:20 }} animate={{ scale:1, opacity:1, y:0 }}
            exit={{ scale:.9, opacity:0 }} transition={{ type:"spring", damping:22, stiffness:300 }}>
            <button onClick={() => setVisible(false)} className="absolute right-4 top-4 z-10 rounded-full bg-black/10 p-1.5 hover:bg-black/20 transition">
              <X size={16} className="text-white"/>
            </button>
            {/* Top banner */}
            <div className="bg-gradient-to-br from-navy-900 to-navy-700 px-7 py-10 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 text-[120px] flex items-end justify-end pr-4 select-none">👓</div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-gold-500/20 border border-gold-500/40 px-3 py-1 text-xs font-semibold text-gold-300 mb-3">
                  <Tag size={12}/> Limited Time Offer
                </div>
                <p className="font-extrabold text-5xl text-gold-400">{offer.label}</p>
                <p className="text-slate-300 mt-2 text-sm">{offer.sub}</p>
              </div>
            </div>
            {/* Coupon */}
            <div className="px-7 py-7 space-y-5 text-center">
              <div>
                <p className="text-sm text-slate-500 mb-2">Use code at checkout</p>
                <button onClick={copyCode}
                  className="inline-flex items-center gap-3 rounded-2xl border-2 border-dashed border-gold-400 bg-gold-50 px-6 py-3 transition hover:bg-gold-100 group">
                  <span className="font-mono text-2xl font-extrabold tracking-widest text-navy-900">{offer.code}</span>
                  <span className={`text-xs font-semibold transition ${copied?"text-emerald-600":"text-gold-600 group-hover:text-gold-700"}`}>
                    {copied ? "✓ Copied!" : "Copy"}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/eyeglasses" onClick={() => setVisible(false)}
                  className="rounded-xl bg-navy-800 py-3.5 text-sm font-bold text-white hover:bg-navy-700 transition">
                  Shop Eyeglasses
                </Link>
                <Link href="/eye-test" onClick={() => setVisible(false)}
                  className="rounded-xl border-2 border-navy-800 py-3.5 text-sm font-bold text-navy-800 hover:bg-navy-50 transition">
                  Book Eye Test
                </Link>
              </div>
              <button onClick={() => setVisible(false)} className="text-xs text-slate-400 hover:text-slate-600 transition">
                No thanks, I'll pay full price
              </button>
            </div>
            {/* Trust strip */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex justify-center gap-6 text-xs text-slate-500">
              <span>✓ 100% Genuine</span><span>✓ Free Returns</span><span>✓ Expert Support</span>
            </div>
          </motion.div>
        </div>)}
    </AnimatePresence>);
}
