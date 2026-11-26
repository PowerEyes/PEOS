"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, Users, ShoppingCart, Calendar, FileText, ClipboardCheck, Hammer, Receipt } from "lucide-react";
import { routeAllowed } from "@/lib/rbac";
// Shortcuts into the existing workflows (each opens that screen's own create drawer via ?new=1). Hidden when the role cannot open the screen.
const ITEMS = [
  { label: "New customer", href: "/customers?new=1", icon: Users }, { label: "New sale", href: "/sales?new=1", icon: ShoppingCart },
  { label: "New appointment", href: "/appointments?new=1", icon: Calendar }, { label: "New prescription", href: "/prescriptions?new=1", icon: FileText },
  { label: "New purchase", href: "/purchases?new=1", icon: ClipboardCheck }, { label: "New repair", href: "/repairs?new=1", icon: Hammer }, { label: "New expense", href: "/finance", icon: Receipt },
];
export function QuickCreate({ role, perms }: { role: string; perms?: string[] }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  const list = ITEMS.filter((i) => routeAllowed(role, i.href.split("?")[0], perms ?? []));
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }, k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", d); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); };
  }, [open]);
  if (!list.length) return null;
  return (<div ref={ref} className="relative">
    <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Quick create" className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
      <Plus size={14} /><span className="hidden sm:inline">Create</span></button>
    {open && <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
      {list.map((i) => <Link key={i.href} role="menuitem" href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"><i.icon size={14} className="text-slate-400" />{i.label}</Link>)}</div>}
  </div>);
}
