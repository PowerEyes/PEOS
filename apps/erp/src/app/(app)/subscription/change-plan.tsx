"use client";
import { useState, useTransition } from "react";
import { changePlan, cancelSubscription, reactivateSubscription, extendSubscription } from "./actions";

type Plan = { id: string; code: string; name: string };

export function SubscriptionActions({ orgId, plans, status }: { orgId: string; plans: Plan[]; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [planId, setPlanId] = useState("");
  const restricted = ["expired", "suspended", "cancelled", "none", "inactive"].includes(status);

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
      {restricted
        ? <button disabled={pending} className="btn bg-emerald-600 text-white disabled:opacity-50" onClick={() => { setMsg({}); start(async () => setMsg(await reactivateSubscription())); }}>Reactivate</button>
        : <button disabled={pending} className="btn btn-ghost text-rose-600 disabled:opacity-50" onClick={() => { setMsg({}); start(async () => setMsg(await cancelSubscription())); }}>Cancel</button>}
      <button disabled={pending} className="btn btn-ghost disabled:opacity-50" onClick={() => { setMsg({}); start(async () => setMsg(await extendSubscription(30))); }}>+30 days</button>
      {msg.error && <p className="w-full text-xs text-rose-600">{msg.error}</p>}
      {msg.ok && <p className="w-full text-xs text-emerald-600">{msg.ok}</p>}
    </div>
  );
}
