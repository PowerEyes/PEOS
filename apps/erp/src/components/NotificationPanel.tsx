"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ClipboardCheck } from "lucide-react";
import type { ShellCounts } from "@/app/(app)/shell-actions";
// Both menus read live counts from the database (via getShellCounts) — nothing here is static.
function Menu({ icon, label, total, tone, children }: { icon: React.ReactNode; label: string; total: number; tone: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }, k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", d); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); };
  }, [open]);
  return (<div ref={ref} className="relative"><button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${label}${total ? `, ${total} pending` : ""}`}
    className="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">{icon}
    {total > 0 && <span className={`absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full px-1 text-center text-[10px] font-bold leading-4 text-white ${tone}`}>{total > 99 ? "99+" : total}</span>}</button>
    {open && <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"><p className="px-2 py-1 text-xs font-semibold text-slate-500">{label}</p>{children}</div>}</div>);
}
export function NotificationPanel({ counts, loading }: { counts: ShellCounts | null; loading: boolean }) {
  const n = counts?.items.reduce((a, i) => a + i.count, 0) ?? 0, a = counts?.approvals.reduce((s, i) => s + i.count, 0) ?? 0;
  const empty = <p className="px-2 py-3 text-xs text-slate-400">{loading ? "Loading…" : "All clear."}</p>;
  return (<>
    <Menu icon={<ClipboardCheck size={18} />} label="Pending approvals" total={a} tone="bg-orange-500">
      {counts?.approvals.length ? counts.approvals.map((x) => <Link key={x.href} href={x.href} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><span>{x.label}</span><b>{x.count}</b></Link>) : empty}</Menu>
    <Menu icon={<Bell size={18} />} label="Notifications" total={n} tone="bg-rose-500">
      {counts?.items.length ? counts.items.map((x) => <Link key={x.key} href={x.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><span>{x.label}</span><b className={x.tone === "bad" ? "text-rose-600" : "text-amber-600"}>{x.count}</b></Link>) : empty}</Menu>
  </>);
}
