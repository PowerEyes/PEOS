
"use client";
import { useState } from "react";
import { Share2, Copy, Check, Users } from "lucide-react";

export function ReferralPanel({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const r = await fetch("/api/referral", { method:"POST" });
    const d = await r.json();
    setLoading(false);
    if (d.link) { setLink(d.link); setCode(d.code); }
  }

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-white p-6 mt-5">
      <div className="flex items-start gap-3 mb-4">
        <Users size={22} className="text-gold-400 shrink-0 mt-0.5"/>
        <div>
          <p className="font-bold text-lg">Refer Friends — Earn 200 Points</p>
          <p className="text-slate-300 text-sm mt-0.5">Every friend who orders using your link earns you 200 loyalty points, and they get ₹100 off their first order.</p>
        </div>
      </div>

      {!link ? (
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-white hover:bg-gold-600 transition disabled:opacity-60">
          <Share2 size={15}/>{loading ? "Generating…" : "Generate My Referral Link"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-white/10 border border-white/20 p-3 flex items-center justify-between gap-3">
            <p className="text-sm font-mono text-gold-300 truncate">{link}</p>
            <button onClick={copy} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-gold-600 transition">
              {copied ? <><Check size={12}/>Copied!</> : <><Copy size={12}/>Copy</>}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=Get%20eyeglasses%20at%20Power%20Eyes%20Opticals%20with%20₹100%20off%20using%20my%20link%3A%20${encodeURIComponent(link)}`}
              target="_blank" className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">
              💬 Share on WhatsApp
            </a>
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition">
              <Copy size={12}/>Code: {code}
            </button>
          </div>
          <p className="text-xs text-slate-400">Your referral code is <span className="text-gold-400 font-mono font-bold">{code}</span>. Share it or the link above.</p>
        </div>)}
    </div>);
}
