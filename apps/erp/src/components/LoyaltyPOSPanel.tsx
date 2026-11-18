
"use client";
import { useEffect, useState } from "react";
import { Star, Plus, Minus, Gift, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

const ORG = "00000000-0000-0000-0000-000000000001";
const inr  = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

type Props = {
  customerId: string;
  billAmount: number;
  onRedeemChange: (discount: number, points: number) => void;
};

export function LoyaltyPOSPanel({ customerId, billAmount, onRedeemChange }: Props) {
  const [points,  setPoints]  = useState(0);
  const [rules,   setRules]   = useState({ earn_rate:10, redeem_rate:100, min_redeem:100, max_redeem_pct:20 });
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [redeemPts, setRedeemPts] = useState(0);
  const [manualAward, setManualAward] = useState("");
  const [manualNote,  setManualNote]  = useState("");
  const [awardBusy, setAwardBusy] = useState(false);
  const [awardMsg,  setAwardMsg]  = useState("");

  // Points earned from this bill
  const willEarn = Math.floor(billAmount / 100 * rules.earn_rate);

  // Redemption limits
  const maxRedeemable      = Math.min(points, Math.floor(billAmount * rules.max_redeem_pct / 100 / 10) * rules.redeem_rate);
  const redeemDiscount     = Math.floor(redeemPts / rules.redeem_rate) * 10;
  const redeemStep         = rules.redeem_rate; // 100 pts = ₹10

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    const sb = supabaseBrowser();
    Promise.all([
      sb.from("loyalty_ledger").select("delta").eq("customer_id", customerId),
      sb.from("loyalty_rules").select("*").eq("org_id", ORG).single(),
    ]).then(([ledger, rulesRes]) => {
      const total = (ledger.data ?? []).reduce((a:number,r:any)=>a+Number(r.delta),0);
      setPoints(Math.max(0, total));
      if (rulesRes.data) setRules(rulesRes.data as any);
      setLoading(false);
    });
  }, [customerId]);

  useEffect(() => {
    onRedeemChange(redeemDiscount, redeemPts);
  }, [redeemPts]);

  function adjustRedeem(delta: number) {
    setRedeemPts(prev => {
      const next = Math.max(0, Math.min(maxRedeemable, prev + delta));
      // Round to nearest step
      return Math.round(next / redeemStep) * redeemStep;
    });
  }

  async function awardManual() {
    if (!manualAward || Number(manualAward) === 0) return;
    setAwardBusy(true); setAwardMsg("");
    const delta = Number(manualAward);
    const sb = supabaseBrowser();
    const { error } = await sb.from("loyalty_ledger").insert({
      org_id: ORG, customer_id: customerId,
      delta, reason: "manual",
      staff_note: manualNote || `Manual ${delta>0?"credit":"debit"} by staff`,
    });
    setAwardBusy(false);
    if (error) { setAwardMsg("Error: " + error.message); return; }
    setPoints(prev => prev + delta);
    setManualAward("");
    setAwardMsg(`${delta>0?"Added":"Deducted"} ${Math.abs(delta)} pts successfully.`);
  }

  if (!customerId) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header toggle */}
      <button type="button" onClick={() => setOpen(o=>!o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-gold-500"/>
          <span className="text-sm font-semibold text-slate-700">Loyalty Points</span>
          {loading
            ? <span className="text-xs text-slate-400">Loading…</span>
            : <span className="rounded-full bg-gold-100 text-gold-700 px-2 py-0.5 text-xs font-bold">{points.toLocaleString()} pts</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
      </button>

      {open && !loading && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Points summary */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-gold-50 p-2.5">
              <p className="font-bold text-xl text-gold-700">{points.toLocaleString()}</p>
              <p className="text-gold-600 font-medium">Available</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5">
              <p className="font-bold text-xl text-blue-700">+{willEarn}</p>
              <p className="text-blue-600 font-medium">Will Earn</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="font-bold text-xl text-emerald-700">{inr(redeemDiscount)}</p>
              <p className="text-emerald-600 font-medium">Redeemed</p>
            </div>
          </div>

          {/* Redeem slider */}
          {points >= rules.min_redeem && maxRedeemable > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Redeem Points as Discount</p>
              <p className="text-xs text-slate-400">{rules.redeem_rate} pts = ₹10 discount · Max {rules.max_redeem_pct}% of bill</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>adjustRedeem(-redeemStep)} disabled={redeemPts===0}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-30"><Minus size={15}/></button>
                <div className="flex-1 text-center">
                  <p className="font-bold text-lg text-navy-900">{redeemPts} pts</p>
                  <p className="text-xs text-emerald-600 font-semibold">= {inr(redeemDiscount)} off</p>
                </div>
                <button type="button" onClick={()=>adjustRedeem(redeemStep)} disabled={redeemPts>=maxRedeemable}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-30"><Plus size={15}/></button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>setRedeemPts(0)} className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-medium hover:bg-slate-50">Clear</button>
                <button type="button" onClick={()=>setRedeemPts(maxRedeemable)} className="flex-1 rounded-xl bg-gold-500 py-2 text-xs font-bold text-white hover:bg-gold-600">Use Max ({inr(Math.floor(maxRedeemable/rules.redeem_rate)*10)})</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 text-center">
              {points < rules.min_redeem
                ? `Minimum ${rules.min_redeem} points needed to redeem. Currently ${points} pts.`
                : "No redeemable amount for this bill size."}
            </div>)}

          {/* Manual award / deduct */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><Gift size={12}/>Manual Award / Adjust</p>
            <div className="flex gap-2">
              <input value={manualAward} onChange={e=>setManualAward(e.target.value)} type="number"
                placeholder="e.g. 50 or -25" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy-700"/>
              <button type="button" onClick={awardManual} disabled={awardBusy || !manualAward}
                className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-bold text-white hover:bg-navy-700 disabled:opacity-50">
                {awardBusy?"…":"Award"}
              </button>
            </div>
            <input value={manualNote} onChange={e=>setManualNote(e.target.value)} placeholder="Reason (e.g. Birthday bonus, Complaint resolution)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-navy-700"/>
            {awardMsg && <p className={`text-xs flex items-center gap-1 ${awardMsg.startsWith("Error")?"text-rose-600":"text-emerald-600"}`}><AlertCircle size={12}/>{awardMsg}</p>}
          </div>

          <p className="text-[10px] text-slate-400 text-center">Points are credited automatically when this sale is completed. {willEarn > 0 && `Customer earns +${willEarn} pts from this purchase.`}</p>
        </div>)}
    </div>);
}
