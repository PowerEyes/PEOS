
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, Calendar, ShoppingCart, Wrench,
  Package, DollarSign, Settings, Globe, LogOut, ChevronDown, ChevronRight,
  Hammer, UserCheck, ReceiptText, MessageCircle, Tag, TrendingUp, FileBarChart,
  Stethoscope,
} from "lucide-react";

type NavItem = {
  label: string; href?: string; icon: any;
  badge?: string; children?: { label:string; href:string; icon:any }[];
};

const NAV: NavItem[] = [
  { label:"Dashboard",        href:"/",                  icon:LayoutDashboard },
  { label:"Customers",        href:"/customers",         icon:Users },
  { label:"Prescriptions",    href:"/prescriptions",     icon:FileText },
  { label:"Appointments",     href:"/appointments",      icon:Calendar },
  { label:"POS & Orders",     href:"/sales",             icon:ShoppingCart },
  { label:"Workshop & Lab",   href:"/workshop",          icon:Wrench },
  { label:"Repairs",          href:"/repairs",           icon:Hammer },
  { label:"Inventory",        href:"/inventory",         icon:Package },
  { label:"Purchase Invoices",href:"/purchase-invoices", icon:ReceiptText },
  {
    label:"Finance", icon:DollarSign,
    children:[
      { label:"Overview",       href:"/finance",           icon:DollarSign },
      { label:"Sales Report",   href:"/finance/reports",   icon:TrendingUp },
      { label:"GSTR-1 Export",  href:"/finance/gstr1",     icon:FileBarChart },
    ],
  },
  { label:"CRM Automation",   href:"/crm",               icon:MessageCircle },
  { label:"Staff",            href:"/staff",             icon:UserCheck },
  {
    label:"Website", icon:Globe,
    children:[
      { label:"Website Studio", href:"/website",           icon:Globe },
      { label:"Coupons",        href:"/website/coupons",   icon:Tag },
    ],
  },
  { label:"Settings",         href:"/settings",          icon:Settings },
];

function NavLink({ item, depth=0 }: { item:NavItem; depth?:number }) {
  const path = usePathname();
  const [open, setOpen] = useState(() => item.children?.some(c => path.startsWith(c.href)) ?? false);

  if (item.children) {
    const anyActive = item.children.some(c => path === c.href || path.startsWith(c.href+"/"));
    return (
      <div>
        <button onClick={() => setOpen(o=>!o)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${anyActive?"text-navy-900 bg-navy-50":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
          <item.icon size={17} className={anyActive?"text-navy-700":"text-slate-400"}/>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
            {item.children.map(c => <NavLink key={c.href} item={c} depth={1}/>)}
          </div>)}
      </div>);
  }

  const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href+"/");
  return (
    <Link href={item.href!}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active?"bg-navy-800 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
      <item.icon size={17} className={active?"text-white":"text-slate-400"}/>
      <span className="flex-1">{item.label}</span>
      {item.badge && <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
    </Link>);
}

export function Shell({ children, user, branches, settings }: {
  children: React.ReactNode;
  user?: { name: string; role: string };
  branches?: { id: string; name: string }[];
  settings?: any;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const path = usePathname();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-white border-r border-slate-200 shadow-sm transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen?"-translate-x-0":"-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-navy-800 text-white font-bold text-sm select-none">👁</div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm text-navy-900 leading-tight">PowerOS</p>
            <p className="text-[9px] text-slate-400 tracking-wider uppercase">Power Eyes Opticals</p>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map(item => <NavLink key={item.label} item={item}/>)}
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(o=>!o)} className="rounded-lg p-1.5 hover:bg-slate-100 lg:hidden">
            <span className="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="hidden sm:block">Power Eyes Opticals</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {user && (
              <span className="hidden sm:flex items-center gap-2 text-xs text-slate-500" title={branches?.length ? `${branches.length} branch${branches.length>1?"es":""}` : undefined}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-800 font-bold text-[10px] text-white">{(user.name||"?").slice(0,1).toUpperCase()}</span>
                <span className="font-medium text-navy-900">{user.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{user.role}</span>
              </span>)}
            <Link href="/" className="hover:text-navy-700 text-xs">← Website</Link>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>);
}
