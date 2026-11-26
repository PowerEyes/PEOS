"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { BranchSwitcher } from "./BranchSwitcher";
import { visibleNav, type NavGroup, type NavUser } from "@/lib/nav";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const Badge = ({ n }: { n?: number }) => (n ? <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold leading-4 text-white">{n > 99 ? "99+" : n}</span> : null);

export function Sidebar({ user, tenantName, branches, scope, collapsed, onToggleCollapse, drawerOpen, onClose, badges }: {
  user: NavUser; tenantName?: string; branches: { id: string; name: string }[]; scope: string | null; collapsed: boolean; onToggleCollapse: () => void;
  drawerOpen: boolean; onClose: () => void; badges: Record<string, number>;
}) {
  const path = usePathname(), groups = visibleNav(user);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setOpen(JSON.parse(localStorage.getItem("nav-open") || "{}")); } catch { /* ignore */ } }, []);
  const toggle = (k: string) => setOpen((o) => { const n = { ...o, [k]: !(o[k] ?? false) }; try { localStorage.setItem("nav-open", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const gBadge = (g: NavGroup) => g.items.reduce((s, i) => s + (i.badge ? badges[i.badge] ?? 0 : 0), 0);
  useEffect(() => { onClose(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (<>
    {drawerOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />}
    <aside aria-label="Main navigation" className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 transition-[transform,width] duration-200 lg:static ${collapsed ? "lg:w-16" : "lg:w-64"} w-72 ${drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className={`flex h-14 shrink-0 items-center border-b border-white/10 ${collapsed ? "lg:justify-center lg:px-2" : ""} justify-between px-4`}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500 text-white"><Eye size={17} /></span>
          <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}><span className="block truncate text-sm font-extrabold leading-tight text-white">PowerOS</span>
            {tenantName && <span className="block truncate text-[10px] uppercase tracking-wider text-slate-400">{tenantName}</span>}</span></Link>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu"><X size={18} /></button>
      </div>
      {!collapsed && <div className="border-b border-white/10 px-3 py-2"><BranchSwitcher branches={branches} scope={scope} /></div>}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {groups.map((g) => {
          const single = g.items.length === 1, active = g.items.some((i) => isActive(path, i.href)), expanded = (open[g.key] ?? false) || active;
          if (collapsed) return (<Link key={g.key} href={g.items[0].href} aria-label={g.label} className={`group relative hidden items-center justify-center rounded-xl p-2.5 lg:flex ${active ? "bg-orange-500/20 text-orange-400" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
            <g.icon size={18} /><span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow group-hover:opacity-100 group-focus-visible:opacity-100">{g.label}</span></Link>);
          if (single) { const i = g.items[0]; return (<Link key={g.key} href={i.href === "/" ? "/?d=1" : i.href} aria-current={isActive(path, i.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-orange-500/20 font-semibold text-orange-400" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            <g.icon size={17} /><span className="flex-1">{g.label}</span><Badge n={i.badge ? badges[i.badge] : 0} /></Link>); }
          return (<div key={g.key}>
            <button onClick={() => toggle(g.key)} aria-expanded={expanded} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/5 font-semibold text-orange-400" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              <g.icon size={17} /><span className="flex-1 text-left">{g.label}</span>{!expanded && <Badge n={gBadge(g)} />}{expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}</button>
            {expanded && <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">{g.items.map((i) => { const a = isActive(path, i.href) && !g.items.some((o) => o !== i && o.href.length > i.href.length && isActive(path, o.href));
              return (<li key={i.href}><Link href={i.href} aria-current={a ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition ${a ? "bg-orange-500/20 font-semibold text-orange-400" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <span className="flex-1">{i.label}</span><Badge n={i.badge ? badges[i.badge] : 0} /></Link></li>); })}</ul>}
          </div>);
        })}
      </nav>
      <div className="hidden border-t border-white/10 p-2 lg:block"><button onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white">
        {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}</button></div>
    </aside>
  </>);
}
