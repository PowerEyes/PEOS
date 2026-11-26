"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTempBranch, revokeTempAssignment } from "./actions";
// Temporary cross-branch access (max 90 days, reason required, auto-expires, fully audited).
export function Assignments({ staff, branches, assignments }: { staff: any[]; branches: any[]; assignments: any[] }) {
  const router = useRouter(); const [f, setF] = useState({ p: "", b: "", end: "", reason: "" }); const [msg, setMsg] = useState("");
  const name = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "—"; const bn = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const live = assignments.filter((a) => !a.revoked_at && new Date(a.ends_at) > new Date());
  async function go(fn: () => Promise<{ error?: string; ok?: string }>) { const r = await fn(); setMsg(r.error ?? r.ok ?? ""); router.refresh(); }
  return (<section className="card space-y-3 p-4"><h2 className="font-semibold">Temporary branch access</h2>{msg && <p className="text-sm text-slate-600">{msg}</p>}
    <div className="grid gap-2 sm:grid-cols-5">
      <select className="field" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })}><option value="">Staff</option>{staff.filter((s) => s.is_approved && !s.deactivated && !["owner", "admin"].includes(s.role_key)).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
      <select className="field" value={f.b} onChange={(e) => setF({ ...f, b: e.target.value })}><option value="">Branch</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      <input className="field" type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
      <input className="field" placeholder="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      <button className="btn btn-primary" disabled={!f.p || !f.b || !f.end || !f.reason} onClick={() => go(() => assignTempBranch(f.p, f.b, f.end, f.reason))}>Grant</button></div>
    {live.map((a) => (<p key={a.id} className="flex items-center justify-between text-sm"><span>{name(a.profile_id)} → {bn(a.branch_id)} until {new Date(a.ends_at).toLocaleString("en-IN")} — {a.reason}</span>
      <button className="underline" onClick={() => go(() => revokeTempAssignment(a.id))}>Revoke</button></p>))}</section>);
}
