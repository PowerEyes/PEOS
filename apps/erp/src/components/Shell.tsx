
"use client";
import Link from "next/link";
import { BranchSwitcher } from "./BranchSwitcher";
import { ScopeProvider } from "./ScopeContext";
import { routeAllowed } from "@/lib/rbac";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, Calendar, ShoppingCart, Wrench,
  Package, DollarSign, Settings, Globe, LogOut, ChevronDown, ChevronRight,
  Hammer, UserCheck, ReceiptText, MessageCircle, Tag, TrendingUp, FileBarChart,
  Stethoscope, Wallet, ClipboardCheck, LifeBuoy, Building2,
} from "lucide-react";

type NavItem = {
  label: string; href?: string; icon: any;
  badge?: string; children?: { label:string; href:string; icon:any }[];
};

const ok = (href: string | undefined, u?: { role: string; perms?: string[] }) => !href || routeAllowed(u?.role, href.split("?")[0], u?.perms ?? []);
function visible(item: NavItem, u?: { role: string; perms?: string[] }): NavItem | null {
  if (item.children) { const ch = item.children.filter(c => ok(c.href, u)); return ch.length ? { ...item, children: ch } : null; }
  return ok(item.href, u) ? item : null;
}
const NAV: NavItem[] = [
  { label:"Dashboard",        href:"/",                  icon:LayoutDashboard },
  { label:"Customers",        href:"/customers",         icon:Users },
  { label:"Prescriptions",    href:"/prescriptions",     icon:FileText },
  { label:"Appointments",     href:"/appointments",      icon:Calendar },
  { label:"POS & Orders",     href:"/sales",             icon:ShoppingCart },
  { label:"Workshop & Lab",   href:"/workshop",          icon:Wrench },
  { label:"Repairs",          href:"/repairs",           icon:Hammer },
  { label:"Inventory",        href:"/inventory",         icon:Package },
  { label:"Stock Transfers",  href:"/transfers",         icon:Package },
  { label:"Purchase Invoices",href:"/purchase-invoices", icon:ReceiptText },
  { label:"Purchase Orders",  href:"/purchases",         icon:ClipboardCheck },
  { label:"Stock Audit",      href:"/stock-audits",      icon:Package },
  { label:"Inbox & Alerts",   href:"/inbox",             icon:MessageCircle },
  { label:"Website Orders",   href:"/web-orders",        icon:ShoppingCart },
  { label:"Audit Log",        href:"/audit",             icon:FileText },
  {
    label:"Finance", icon:DollarSign,
    children:[
      { label:"Overview",       href:"/finance",           icon:DollarSign },
      { label:"Cashbook",       href:"/finance?tab=Cashbook", icon:Wallet },
      { label:"Sales Report",   href:"/finance/reports",   icon:TrendingUp },
      { label:"GSTR-1 Export",  href:"/finance/gstr1",     icon:FileBarChart },
      { label:"Accountant Export", href:"/accountant-export", icon:FileBarChart },
    ],
  },
  { label:"CRM Automation",   href:"/crm",               icon:MessageCircle },
  { label:"Staff",            href:"/staff",             icon:UserCheck },
  { label:"Subscription",     href:"/subscription",      icon:Wallet },
  { label:"Support",          href:"/support",           icon:LifeBuoy },
  { label:"Setup checklist",  href:"/setup",             icon:ClipboardCheck },
  {
    label:"Website", icon:Globe,
    children:[
      { label:"Website Studio", href:"/website",           icon:Globe },
      { label:"Coupons",        href:"/website/coupons",   icon:Tag },
    ],
  },
  { label:"Company",          href:"/company",            icon:Building2 },
  { label:"Settings",         href:"/settings",          icon:Settings },
  { label:"Store Domains",    href:"/settings/domains",  icon:Globe },
];

function NavLink({ item, depth=0, onNavigate }: { item:NavItem; depth?:number; onNavigate?: () => void }) {
  const path = usePathname();
  const [open, setOpen] = useState(() => item.children?.some(c => path.startsWith(c.href)) ?? false);

  if (item.children) {
    const anyActive = item.children.some(c => path === c.href || path.startsWith(c.href+"/"));
    return (
      <div>
        <button onClick={() => setOpen(o=>!o)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${anyActive?"text-navy-900 bg-navy-50 font-semibold":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
          <item.icon size={17} className={anyActive?"text-navy-700":"text-slate-400"}/>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
            {item.children.map(c => <NavLink key={c.href} item={c} depth={1} onNavigate={onNavigate}/>)}
          </div>)}
      </div>);
  }

  const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href+"/");
  return (
    <Link href={item.href!} onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?"bg-navy-800 text-white shadow-sm font-semibold":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
      <item.icon size={17} className={active?"text-white":"text-slate-400"}/>
      <span className="flex-1">{item.label}</span>
      {item.badge && <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
    </Link>);
}

export function Shell({ children, user, branches, settings, scope = null }: {
  scope?: string | null;
  children: React.ReactNode;
  user?: { name: string; role: string; perms?: string[] };
  branches?: { id: string; name: string }[];
  settings?: any;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const path = usePathname();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-navy-900/50 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)}/>)}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 max-w-[calc(100vw-48px)] flex-col bg-white border-r border-slate-200 shadow-xl lg:shadow-none transition-transform duration-200 lg:static lg:w-60 lg:translate-x-0 ${sidebarOpen?"translate-x-0":"-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-navy-800 text-white font-bold text-sm select-none shrink-0">👁</div>
            <div className="min-w-0">
              <p className="font-extrabold text-sm text-navy-900 leading-tight truncate">PowerOS</p>
              <p className="text-[9px] text-slate-400 tracking-wider uppercase truncate">Power Eyes Opticals</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden" aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map(item => visible(item, user)).filter(Boolean).map(item => <NavLink key={item!.label} item={item!} onNavigate={() => setSidebarOpen(false)}/>)}
        </nav>
        {/* Footer */}
        <div className="border-t border-slate-200 p-3">
          <form action="/api/logout" method="POST">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition">
              <LogOut size={16}/> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o=>!o)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 lg:hidden" aria-label="Toggle navigation">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <span className="truncate">Power Eyes Opticals</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {user && <BranchSwitcher branches={branches ?? []} scope={scope} />}
            {user && (
              <span className="hidden sm:flex items-center gap-2 text-xs text-slate-500" title={branches?.length ? `${branches.length} branch${branches.length>1?"es":""}` : undefined}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-800 font-bold text-[10px] text-white">{(user.name||"?").slice(0,1).toUpperCase()}</span>
                <span className="font-medium text-navy-900">{user.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{user.role}</span>
              </span>)}
            <Link href="/" className="hover:text-navy-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-slate-50 transition">← Website</Link>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ScopeProvider value={scope}>{children}</ScopeProvider>
        </main>
      </div>
    </div>);
}
