"use client";
import { useState, useTransition } from "react";
import { changeSubscriptionPlan, suspendCompany } from "../../actions";

type Plan = { id: string; code: string; name: string };

export function CompanySubscriptionPanel({ orgId, sub, plans }: { orgId: string; sub: any; plans: Plan[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [planId, setPlanId] = useState<string>(sub?.plan_id ?? plans[0]?.id ?? "");
  const suspended = sub?.status === "suspended";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="mb-3 text-sm font-semibold">Subscription</p>
      <div className="space-y-3 text-sm">
        <div><span className="text-slate-400">Current plan</span><p className="font-medium">{plans.find((p) => p.id === sub?.plan_id)?.name ?? "—"}</p></div>
        <div><span className="text-slate-400">Status</span><p className="capitalize">{sub?.status ?? "none"}</p></div>
        <label className="block"><span className="text-slate-400">Change plan</span>
          <select className="input mt-1 w-full" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button disabled={pending || !planId} className="btn bg-gold-500 text-slate-950 disabled:opacity-50"
            onClick={() => { setMsg({}); start(async () => setMsg(await changeSubscriptionPlan(orgId, planId))); }}>
            Apply plan
          </button>
          <button disabled={pending} className={suspended ? "btn bg-emerald-600 text-white" : "btn bg-rose-600 text-white"}
            onClick={() => { setMsg({}); start(async () => setMsg(await suspendCompany(orgId, !suspended))); }}>
            {suspended ? "Reactivate" : "Suspend"}
          </button>
        </div>
        {msg.error && <p className="text-xs text-rose-400">{msg.error}</p>}
        {msg.ok && <p className="text-xs text-emerald-400">{msg.ok}</p>}
      </div>
    </div>
  );
}
