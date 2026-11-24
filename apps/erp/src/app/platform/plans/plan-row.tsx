"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { savePlan, setPlanActive } from "../actions";

type Plan = Record<string, any>;

export function PlanRow({ plan, money }: { plan: Plan; money: (p: number | null) => string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [f, setF] = useState({
    code: plan.code, name: plan.name, price_minor: plan.price_minor == null ? null : Number(plan.price_minor),
    interval: plan.interval, trial_days: plan.trial_days ?? 14, grace_days: plan.grace_days ?? 7,
    max_branches: plan.max_branches, max_employees: plan.max_employees,
    max_customers: plan.max_customers, storage_mb: plan.storage_mb,
    features: plan.features ?? {},
  });

  const toggle = (k: string) => setF((s) => ({ ...s, features: { ...s.features, [k]: !s.features?.[k] } }));

  if (editing) {
    return (
      <tr className="bg-slate-900/60">
        <td colSpan={8} className="px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-400">Code<input className="input mt-1 w-full" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
            <label className="text-xs text-slate-400">Name<input className="input mt-1 w-full" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="text-xs text-slate-400">Price (paise/mo)<input className="input mt-1 w-full" type="number" value={f.price_minor ?? ""} onChange={(e) => setF({ ...f, price_minor: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-400">Trial days<input className="input mt-1 w-full" type="number" value={f.trial_days} onChange={(e) => setF({ ...f, trial_days: Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-400">Grace days<input className="input mt-1 w-full" type="number" value={f.grace_days} onChange={(e) => setF({ ...f, grace_days: Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-400">Max branches<input className="input mt-1 w-full" type="number" placeholder="unlimited" value={f.max_branches ?? ""} onChange={(e) => setF({ ...f, max_branches: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-400">Max employees<input className="input mt-1 w-full" type="number" placeholder="unlimited" value={f.max_employees ?? ""} onChange={(e) => setF({ ...f, max_employees: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-400">Max customers<input className="input mt-1 w-full" type="number" placeholder="unlimited" value={f.max_customers ?? ""} onChange={(e) => setF({ ...f, max_customers: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <div className="sm:col-span-3">
              <p className="mb-1 text-xs text-slate-400">Features</p>
              <div className="flex flex-wrap gap-2">
                {["pos", "prescriptions", "lab", "lpims", "finance", "multi_branch_reports", "api_integrations", "priority_support"].map((k) => (
                  <button key={k} type="button" onClick={() => toggle(k)}
                    className={`rounded-full px-2.5 py-1 text-xs ${f.features?.[k] ? "bg-gold-500 text-slate-950" : "bg-slate-800 text-slate-400"}`}>{k}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button disabled={pending} className="btn bg-gold-500 text-slate-950 disabled:opacity-50"
              onClick={() => { setMsg({}); start(async () => { const r = await savePlan({ id: plan.id, ...f } as any); setMsg(r); if (r.ok) setEditing(false); }); }}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            {msg.error && <span className="self-center text-xs text-rose-400">{msg.error}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-900/50">
      <td className="px-4 py-3">
        <Link href={`/platform/plans/${plan.id}`} className="block">
          <p className="font-medium text-white hover:text-gold-400">{plan.name}</p>
          <p className="text-xs text-slate-500">{plan.code}</p>
        </Link>
      </td>
      <td className="px-4 py-3">{money(plan.price_minor)}<span className="text-xs text-slate-500">/{plan.interval}</span></td>
      <td className="px-4 py-3 text-slate-400">{plan.trial_days}d</td>
      <td className="px-4 py-3 text-slate-400">{plan.max_branches ?? "∞"}</td>
      <td className="px-4 py-3 text-slate-400">{plan.max_employees ?? "∞"}</td>
      <td className="px-4 py-3 text-slate-400">{plan.max_customers ?? "∞"}</td>
      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${plan.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>{plan.active ? "Live" : "Draft"}</span></td>
      <td className="px-4 py-3">
        <div className="flex gap-2 text-xs">
          <button className="text-gold-400 hover:underline" onClick={() => setEditing(true)}>Edit</button>
          <button className={plan.active ? "text-rose-400 hover:underline" : "text-emerald-400 hover:underline"}
            onClick={() => start(async () => setMsg(await setPlanActive(plan.id, !plan.active)))}>
            {plan.active ? "Deactivate" : "Activate"}
          </button>
        </div>
        {msg.error && <p className="mt-1 text-xs text-rose-400">{msg.error}</p>}
      </td>
    </tr>
  );
}
