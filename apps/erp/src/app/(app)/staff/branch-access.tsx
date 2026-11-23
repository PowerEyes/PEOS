"use client";
import { useState, useTransition } from "react";
import { useToast } from "@poweros/ui";
import { setProfileBranches } from "./actions";

/** Per-person extra branches. Everyone can READ all branches' customer history; this grants WRITE access to more than the home branch. */
export function BranchAccess({ staff, branches, links }: { staff: any[]; branches: any[]; links: { profile_id: string; branch_id: string }[] }) {
  const toast = useToast(); const [pending, start] = useTransition();
  const [sel, setSel] = useState<Record<string, string[]>>(() => { const m: Record<string, string[]> = {}; links.forEach((l) => (m[l.profile_id] ??= []).push(l.branch_id)); return m; });
  const people = staff.filter((s) => s.is_approved && !s.deactivated && !["owner", "admin"].includes(s.role_key));
  if (!people.length || branches.length < 2) return null;
  const toggle = (pid: string, bid: string) => {
    const cur = sel[pid] ?? []; const next = cur.includes(bid) ? cur.filter((x) => x !== bid) : [...cur, bid];
    setSel((s) => ({ ...s, [pid]: next }));
    start(async () => { const r = await setProfileBranches(pid, next); if (r.error) { setSel((s) => ({ ...s, [pid]: cur })); toast(r.error, "err"); } else toast(r.ok ?? "Saved"); });
  };
  return (<section className="card p-5"><h2 className="font-semibold text-slate-900">Branch access</h2>
    <p className="mb-4 text-xs text-slate-500">Everyone can <b>view</b> customers and purchase history across all branches. Tick a branch to also let the person <b>create and edit</b> records there. Their home branch is always included.</p>
    <div className="divide-y divide-slate-100">{people.map((p) => (
      <div key={p.id} className="flex flex-wrap items-center gap-2 py-3"><div className="w-44 min-w-0"><p className="truncate text-sm font-medium">{p.full_name}</p><p className="text-xs capitalize text-slate-500">{p.role_key.replace("_", " ")}</p></div>
        <div className="flex flex-wrap gap-2">{branches.map((b) => { const home = p.branch_id === b.id, on = home || (sel[p.id] ?? []).includes(b.id); return (
          <button key={b.id} disabled={home || pending} onClick={() => toggle(p.id, b.id)} aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-default ${on ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 text-slate-600 hover:border-navy-500"}`}>{b.name}{home ? " · home" : ""}</button>); })}</div></div>))}</div></section>);
}
