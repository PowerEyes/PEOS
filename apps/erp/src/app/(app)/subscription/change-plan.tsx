"use client";
import { useState, useTransition } from "react";
import { changePlan, cancelSubscription, reactivateSubscription } from "./actions";

type Plan = { id: string; code: string; name: string };

export function SubscriptionActions({ orgId, plans, status }: { orgId: string; plans: Plan[]; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [planId, setPlanId] = useState("");
  const cancelled = status === "cancelled";
  const restricted = ["expired", "suspended", "none", "inactive"].includes(status) || cancelled;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-48" value={planId} onChange={(e) => setPlanId(e.target.value)}>
        <option value="">Choose plan…</option>
        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={pending || !planId} className="btn bg-navy-800 text-white disabled:opacity-50"
        onClick={() => { setMsg({}); start(async () => setMsg(await changePlan(planId))); }}>
        {status === "trialing" ? "Choose plan" : "Upgrade / change"}
      </button>
      {cancelled
        ? /* Undo a cancellation inside the paid period; the action refuses once the period is over. */
          <button disabled={pending} className="btn bg-emerald-600 text-white disabled:opacity-50"
            onClick={() => { setMsg({}); start(async () => setMsg(await reactivateSubscription())); }}>Reactivate</button>
        : restricted
          ? /* expired/suspended/none renew through the plan grid below — no free restore here. */
            null
          : <button disabled={pending} className="btn btn-ghost text-rose-600 disabled:opacity-50"
              onClick={() => {
                if (!confirm("Cancel your subscription? Automatic renewal stops. You keep full access until the end of the paid period, your data is retained, and you can reactivate any time before it ends.")) return;
                setMsg({}); start(async () => setMsg(await cancelSubscription()));
              }}>Cancel</button>}
      {msg.error && <p className="w-full text-xs text-rose-600">{msg.error}</p>}
      {msg.ok && <p className="w-full text-xs text-emerald-600">{msg.ok}</p>}
    </div>
  );
}
