"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Star } from "lucide-react";
import { saveLoyalty } from "@/app/(app)/settings-actions";
import { L, SectionCard } from "./ui";

export function LoyaltySection({ loyalty, canEdit }: { loyalty: any; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [earnRate, setEarnRate] = useState(String(loyalty?.earn_rate ?? 10));
  const [redeemRate, setRedeemRate] = useState(String(loyalty?.redeem_rate ?? 100));
  const [minRedeem, setMinRedeem] = useState(String(loyalty?.min_redeem ?? 100));
  const [maxRedeemPct, setMaxRedeemPct] = useState(String(loyalty?.max_redeem_pct ?? 20));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await saveLoyalty({
      earnRate: Number(earnRate),
      redeemRate: Number(redeemRate),
      minRedeem: Number(minRedeem),
      maxRedeemPct: Number(maxRedeemPct),
    });
    setBusy(false);
    r.error ? toast(r.error, "err") : (toast(r.ok!), router.refresh());
  }

  return (
    <SectionCard title="Loyalty points" icon={Star}
      footer={canEdit ? (
        <button disabled={busy} onClick={save} className="btn btn-gold">
          {busy ? "Saving…" : "Save loyalty rules"}
        </button>) : <p className="text-xs text-slate-400">Only owners and admins can change these settings.</p>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <L t="Earn rate" hint="Points earned per ₹100 spent.">
          <input type="number" min={0} className="field" value={earnRate} disabled={!canEdit}
            onChange={(e) => setEarnRate(e.target.value)} />
        </L>
        <L t="Redeem rate" hint="Points needed for ₹10 off a bill.">
          <input type="number" min={1} className="field" value={redeemRate} disabled={!canEdit}
            onChange={(e) => setRedeemRate(e.target.value)} />
        </L>
        <L t="Minimum redeem" hint="Fewest points a customer can redeem at once.">
          <input type="number" min={0} className="field" value={minRedeem} disabled={!canEdit}
            onChange={(e) => setMinRedeem(e.target.value)} />
        </L>
        <L t="Max redeem (% of bill)" hint="Maximum share of a bill payable with points.">
          <input type="number" min={0} max={100} className="field" value={maxRedeemPct} disabled={!canEdit}
            onChange={(e) => setMaxRedeemPct(e.target.value)} />
        </L>
      </div>
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        Points balances appear in POS and in the website cart at checkout. Changing these rules does not adjust points already earned.
      </p>
    </SectionCard>);
}
