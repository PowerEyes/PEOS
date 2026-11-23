"use client";
import { useState, useTransition } from "react";
import { registerCompanyManual } from "../actions";

export function RegisterCompanyForm({ plans }: { plans: { id: string; code: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [f, setF] = useState({ name: "", ownerEmail: "", planCode: plans[0]?.code ?? "starter" });

  if (!open) return <button onClick={() => setOpen(true)} className="btn bg-gold-500 text-slate-950 hover:bg-gold-400">+ Register company</button>;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); setMsg({}); start(async () => setMsg(await registerCompanyManual(f))); }}
        className="space-y-3"
      >
        <input className="input w-full" placeholder="Company name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="input w-full" type="email" placeholder="Owner email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} required />
        <select className="input w-full" value={f.planCode} onChange={(e) => setF({ ...f, planCode: e.target.value })}>
          {plans.map((p) => <option key={p.id} value={p.code}>{p.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button disabled={pending} className="btn bg-gold-500 text-slate-950 disabled:opacity-50">{pending ? "Registering…" : "Register"}</button>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
        </div>
        {msg.error && <p className="text-xs text-rose-400">{msg.error}</p>}
        {msg.ok && <p className="text-xs text-emerald-400">{msg.ok}</p>}
      </form>
    </div>
  );
}
