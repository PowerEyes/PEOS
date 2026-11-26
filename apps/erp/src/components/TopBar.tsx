"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, LogOut, Menu, PanelLeft, Search } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { BranchSwitcher } from "./BranchSwitcher";
import { QuickCreate } from "./QuickCreate";
import { NotificationPanel } from "./NotificationPanel";
import { crumbsFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/rbac";
import type { ShellCounts } from "@/app/(app)/shell-actions";

export function TopBar({ user, branches, scope, counts, loading, onMenu, onToggleCollapse, onSearch }: {
  user: { name: string; role: string; perms?: string[] }; branches: { id: string; name: string }[]; scope: string | null; counts: ShellCounts | null; loading: boolean;
  onMenu: () => void; onToggleCollapse: () => void; onSearch: () => void;
}) {
  const title = crumbsFor(usePathname()).slice(-1)[0]?.label ?? "";
  return (<header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5">
    <button onClick={onMenu} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
    <button onClick={onToggleCollapse} className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:block" aria-label="Toggle sidebar"><PanelLeft size={18} /></button>
    <div className="min-w-0 flex-1 lg:flex-none lg:basis-1/4"><div className="hidden sm:block"><Breadcrumbs /></div><p className="truncate text-sm font-semibold text-slate-800 sm:hidden">{title}</p></div>
    <div className="hidden flex-1 justify-center md:flex"><button onClick={onSearch} aria-label="Search (Ctrl+K)" className="flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-slate-100">
      <Search size={13} /><span className="flex-1 text-left">Search customers, products, orders, staff…</span><kbd className="rounded border border-slate-200 bg-white px-1.5 text-[10px]">⌘K</kbd></button></div>
    <div className="flex items-center gap-1.5">
      <button onClick={onSearch} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Search"><Search size={18} /></button>
      <div className="hidden sm:block"><BranchSwitcher branches={branches} scope={scope} /></div>
      <QuickCreate role={user.role} perms={user.perms} />
      <NotificationPanel counts={counts} loading={loading} />
      <Link href="/support" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Help and support"><LifeBuoy size={18} /></Link>
      <span className="ml-1 hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex"><span className="grid h-7 w-7 place-items-center rounded-full bg-navy-800 text-[11px] font-bold text-white">{(user.name || "?").slice(0, 1).toUpperCase()}</span>
        <span className="leading-tight"><span className="block max-w-[9rem] truncate text-xs font-semibold text-navy-900">{user.name}</span><span className="block text-[10px] text-slate-500">{ROLE_LABELS[user.role] ?? user.role}</span></span></span>
      <form action="/api/logout" method="POST"><button className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Sign out"><LogOut size={18} /></button></form>
    </div></header>);
}
