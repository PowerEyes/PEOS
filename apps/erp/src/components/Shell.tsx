"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, ArrowLeftRight, BarChart3, Bell, Building2, CalendarDays, ChevronDown,
  ChevronLeft, ChevronRight, ClipboardCheck, CreditCard, FileBarChart, FileText,
  Glasses, Globe, HardDrive, Heart, LayoutDashboard, LogOut, Menu, MessageCircle,
  Package, Plus, Receipt, Search, Settings, Shield, ShoppingCart, Store, Stethoscope,
  Truck, UserCheck, Users, Wallet, Wrench, X, Zap, Banknote, Megaphone, Boxes, Tag, Eye,
} from "lucide-react";
import { BranchSwitcher } from "./BranchSwitcher";
import { CommandPalette } from "./CommandPalette";
import { ScopeProvider } from "./ScopeContext";
import { routeAllowed } from "@/lib/rbac";

type Leaf = { label: string; href: string; icon: any; roles?: string[] };
type Group = { label: string; icon: any; children: Leaf[] };
type NavEntry = Leaf | Group;
const isGroup = (n: NavEntry): n is Group => "children" in n;

const NAV: NavEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, children: [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Owner Dashboard", href: "/owner-dashboard", icon: Building2 },
    { label: "Branch Dashboard", href: "/branch-dashboard", icon: Store },
    { label: "Employee Dashboard", href: "/employee-dashboard", icon: Users },
    { label: "Branch Comparison", href: "/owner-dashboard/branch-comparison", icon: BarChart3 },
    { label: "Branch Inventory", href: "/owner-dashboard/branch-inventory", icon: Package },
  ]},
  { label: "Customers & CRM", icon: Users, children: [
    { label: "Customers", href: "/customers", icon: Users },
    { label: "CRM", href: "/crm", icon: MessageCircle },
    { label: "Inbox", href: "/inbox", icon: Bell },
  ]},
  { label: "Clinical", icon: Stethoscope, children: [
    { label: "Appointments", href: "/appointments", icon: CalendarDays },
    { label: "Prescriptions", href: "/prescriptions", icon: FileText },
    { label: "Consultations", href: "/consultations", icon: Eye },
    { label: "LPIMS", href: "/lpims", icon: Glasses },
  ]},
  { label: "Sales & POS", icon: ShoppingCart, children: [
    { label: "Sales & Orders", href: "/sales", icon: ShoppingCart },
    { label: "Web Orders", href: "/web-orders", icon: Globe },
  ]},
  { label: "Inventory", icon: Package, children: [
    { label: "Inventory", href: "/inventory", icon: Package },
    { label: "Stock Transfers", href: "/transfers", icon: ArrowLeftRight },
    { label: "Transfer Approvals", href: "/transfers/approvals", icon: ClipboardCheck },
    { label: "Stock Audits", href: "/stock-audits", icon: Boxes },
  ]},
  { label: "Procurement", icon: Truck, children: [
    { label: "Purchase Orders", href: "/purchases", icon: ClipboardCheck },
    { label: "Purchase Invoices", href: "/purchase-invoices", icon: Receipt },
    { label: "Suppliers", href: "/suppliers", icon: Truck },
  ]},
  { label: "Workshop & Lab", icon: Wrench, children: [
    { label: "Workshop", href: "/workshop", icon: Wrench },
    { label: "Repairs", href: "/repairs", icon: Glasses },
    { label: "Dispensing", href: "/dispensing", icon: Package },
    { label: "Quality Control", href: "/quality-control", icon: ClipboardCheck },
  ]},
  { label: "Finance & Accounts", icon: Wallet, children: [
    { label: "Finance Overview", href: "/finance", icon: Wallet },
    { label: "Finance Reports", href: "/finance/reports", icon: FileBarChart },
    { label: "GSTR-1", href: "/finance/gstr1", icon: FileText },
    { label: "Accountant Export", href: "/accountant-export", icon: FileBarChart },
    { label: "Expenses", href: "/expenses", icon: Receipt },
    { label: "Bank Reconciliation", href: "/bank-reconciliation", icon: Banknote },
  ]},
  { label: "Staff Management", icon: UserCheck, children: [
    { label: "Staff", href: "/staff", icon: Users },
    { label: "Attendance", href: "/staff/attendance", icon: Activity },
    { label: "Leave", href: "/staff/leave", icon: CalendarDays },
  ]},
  { label: "Customer Engagement", icon: Heart, children: [
    { label: "Communications", href: "/communications", icon: Megaphone },
    { label: "Loyalty", href: "/loyalty", icon: Heart },
  ]},
  { label: "Branches", icon: Store, children: [
    { label: "Branch Directory", href: "/branches", icon: Store },
  ]},
  { label: "Reports & Analytics", icon: BarChart3, children: [
    { label: "Reports", href: "/reports", icon: FileBarChart },
    { label: "Branch Comparison", href: "/reports/branch-comparison", icon: BarChart3 },
    { label: "Company Overview", href: "/reports/company-overview", icon: Building2 },
  ]},
  { label: "Website Management", icon: Globe, children: [
    { label: "Website Studio", href: "/website", icon: Globe },
    { label: "Pages", href: "/website/pages", icon: FileText },
    { label: "Coupons", href: "/website/coupons", icon: Tag },
  ]},
  { label: "Settings & Security", icon: Settings, children: [
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Roles & Permissions", href: "/settings/roles", icon: Shield },
    { label: "Domains", href: "/settings/domains", icon: Globe },
    { label: "Security", href: "/settings/security", icon: Lock },
    { label: "Integrations", href: "/settings/integrations", icon: Zap },
    { label: "Backups", href: "/settings/backup", icon: HardDrive },
    { label: "Audit Log", href: "/audit", icon: FileText },
  ]},
  { label: "Subscription & Billing", icon: CreditCard, children: [
    { label: "Subscription", href: "/subscription", icon: CreditCard },
    { label: "Usage", href: "/subscription/usage", icon: BarChart3 },
    { label: "Invoices", href: "/subscription/invoices", icon: Receipt },
  ]},
];

const ROLE_ONLY: Record<string, string[]> = {
  "/settings/roles": ["owner", "admin"],
  "/settings/security": ["owner", "admin"],
  "/settings/integrations": ["owner", "admin"],
  "/settings/backup": ["owner", "admin"],
  "/website": ["owner", "admin"],
  "/website/pages": ["owner", "admin"],
  "/website/coupons": ["owner", "admin"],
  "/staff": ["owner", "admin"],
  "/staff/attendance": ["owner", "admin"],
  "/staff/leave": ["owner", "admin"],
  "/branches": ["owner", "admin", "branch_manager"],
  "/subscription": ["owner", "admin"],
  "/subscription/usage": ["owner", "admin"],
  "/subscription/invoices": ["owner", "admin"],
};
function allowed(href: string, user?: { role: string; perms?: string[] }) {
  const path = href.split("?")[0];
  const role = user?.role ?? "";
  const roles = ROLE_ONLY[path];
  return (!roles || roles.includes(role)) && routeAllowed(role, path, user?.perms ?? []);
}
function activePath(path: string, href: string) {
  const target = href.split("?")[0];
  return target === "/" ? path === "/" : path === target || path.startsWith(target + "/");
}
const ROUTE_LABELS: Record<string, string> = {
  "owner-dashboard": "Owner Dashboard", "branch-dashboard": "Branch Dashboard", "employee-dashboard": "Employee Dashboard",
  "branch-comparison": "Branch Comparison", "branch-inventory": "Branch Inventory", "customers": "Customers",
  "crm": "CRM", "inbox": "Inbox", "appointments": "Appointments", "prescriptions": "Prescriptions",
  "consultations": "Eye Examinations", "lpims": "Lens Catalogue", "sales": "Sales & POS", "web-orders": "Web Orders",
  "inventory": "Inventory", "transfers": "Stock Transfers", "stock-audits": "Stock Audits", "purchases": "Purchase Orders",
  "purchase-invoices": "Purchase Invoices", "suppliers": "Suppliers", "workshop": "Workshop", "repairs": "Repairs",
  "dispensing": "Dispensing", "quality-control": "Quality Control", "finance": "Finance", "reports": "Reports",
  "gstr1": "GSTR-1", "accountant-export": "Accountant Export", "expenses": "Expenses", "bank-reconciliation": "Bank Reconciliation",
  "staff": "Staff", "attendance": "Attendance", "leave": "Leave Management", "communications": "Communications", "loyalty": "Loyalty",
  "branches": "Branches", "website": "Website Studio", "pages": "Website Pages", "coupons": "Coupons", "settings": "Settings",
  "roles": "Roles & Permissions", "domains": "Domains", "security": "Security", "integrations": "Integrations", "backup": "Backups",
  "audit": "Audit Log", "subscription": "Subscription", "usage": "Usage", "invoices": "Invoices", "company": "Company",
  "platform": "Platform Administration", "support": "Support", "new": "New", "performance": "Performance", "cashbook": "Cashbook",
};
function titleCase(value: string) {
  const segments = value.split("/").filter(Boolean);
  return segments.map((s, i) => ROUTE_LABELS[s] ?? (s.match(/^[0-9a-f-]{8,}$/i) ? (i === segments.length - 1 ? "Details" : "Record") : s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))).join(" / ");
}
function pageLabel(path: string) {
  if (path === "/") return "Dashboard";
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return ROUTE_LABELS[last] ?? titleCase(path);
}

function NavGroup({ item, path, collapsed, onNavigate, onExpand }: {
  item: NavEntry; path: string; collapsed: boolean; onNavigate: () => void; onExpand: () => void;
}) {
  const leaves = isGroup(item) ? item.children : [item];
  const active = leaves.some(x => activePath(path, x.href));
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  if (!isGroup(item)) {
    return <Link href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${collapsed ? "justify-center px-2" : ""} ${active ? "bg-orange-500/15 text-orange-300" : "text-slate-300 hover:bg-white/7 hover:text-white"}`}>
      <item.icon size={17} className={active ? "text-orange-400" : "text-slate-400"} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>;
  }
  return <div>
    <button type="button" onClick={() => { if (collapsed) { onExpand(); setOpen(true); } else setOpen(v => !v); }}
      title={collapsed ? item.label : undefined} aria-expanded={open}
      className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${collapsed ? "justify-center px-2" : ""} ${active ? "text-orange-300" : "text-slate-300 hover:bg-white/7 hover:text-white"}`}>
      <item.icon size={17} className={active ? "text-orange-400" : "text-slate-400"} />
      {!collapsed && <><span className="flex-1 truncate text-left">{item.label}</span><ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /></>}
    </button>
    {open && !collapsed && <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-700/80 pl-2">
      {leaves.map(leaf => <Link key={leaf.href} href={leaf.href} onClick={onNavigate}
        aria-current={activePath(path, leaf.href) ? "page" : undefined}
        className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${activePath(path, leaf.href) ? "bg-orange-500/15 font-semibold text-orange-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
        <leaf.icon size={15} /><span>{leaf.label}</span>
      </Link>)}
    </div>}
  </div>;
}

export function Shell({ children, user, branches, tenantName, scope = null, pendingApprovals = 0, canSeeApprovals = false }: {
  scope?: string | null; children: React.ReactNode;
  user?: { name: string; role: string; perms?: string[] };
  branches?: { id: string; name: string }[]; settings?: any; tenantName?: string;
  pendingApprovals?: number; canSeeApprovals?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => { setCollapsed(localStorage.getItem("poweros.sidebar.collapsed") === "true"); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalOpen(v => !v); }
      if (e.key === "Escape") { setCreateOpen(false); setProfileOpen(false); setSidebarOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { setSidebarOpen(false); setCreateOpen(false); setProfileOpen(false); }, [path]);
  const toggleCollapse = () => setCollapsed(v => {
    localStorage.setItem("poweros.sidebar.collapsed", String(!v)); return !v;
  });
  const visibleNav = useMemo(() => NAV.map(entry => {
    if (!isGroup(entry)) return allowed(entry.href, user) ? entry : null;
    const children = entry.children.filter(c => allowed(c.href, user));
    return children.length ? { ...entry, children } : null;
  }).filter(Boolean) as NavEntry[], [user]);
  const createItems = [
    { label: "New Customer", href: "/customers?new=1", icon: Users },
    { label: "New Sale", href: "/sales?new=1", icon: ShoppingCart },
    { label: "New Appointment", href: "/appointments?new=1", icon: CalendarDays },
    { label: "New Prescription", href: "/prescriptions?new=1", icon: FileText },
    { label: "New Purchase", href: "/purchases?new=1", icon: ClipboardCheck },
    { label: "New Repair", href: "/repairs?new=1", icon: Glasses },
    { label: "New Expense", href: "/expenses", icon: Receipt },
  ].filter(x => allowed(x.href, user));
  const pageTitle = pageLabel(path);
  const crumbs = path.split("/").filter(Boolean);
  const roleLabel = (user?.role ?? "User").replace(/_/g, " ");

  return <div className="flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900"><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg">Skip to main content</a>
    {sidebarOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside id="poweros-sidebar" className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#101e32] text-white shadow-2xl transition-all duration-200 lg:static lg:translate-x-0 lg:shadow-none ${collapsed ? "lg:w-[76px]" : "lg:w-[272px]"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className={`flex h-16 shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="PowerOS home">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500 text-lg font-black text-white">P</span>
          {!collapsed && <span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight">PowerOS</span><span className="block truncate text-[10px] uppercase tracking-[.14em] text-slate-400">{tenantName || "Optical ERP"}</span></span>}
        </Link>
        <button className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      {!collapsed && user && <div className="border-b border-white/10 px-3 py-3"><BranchSwitcher branches={branches ?? []} scope={scope} /></div>}
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {visibleNav.map((item) => <NavGroup key={item.label} item={item} path={path} collapsed={collapsed} onNavigate={() => setSidebarOpen(false)} onExpand={() => { localStorage.setItem("poweros.sidebar.collapsed", "false"); setCollapsed(false); }} />)}
      </nav>
      <div className="border-t border-white/10 p-2">
        <button onClick={toggleCollapse} className="hidden min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs text-slate-400 hover:bg-white/5 hover:text-white lg:flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse sidebar</span></>}
        </button>
        <form action="/api/logout" method="POST"><button className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 ${collapsed ? "justify-center" : ""}`}><LogOut size={16} />{!collapsed && "Sign out"}</button></form>
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden" aria-label="Open navigation menu" aria-controls="poweros-sidebar" aria-expanded={sidebarOpen}><Menu size={19} /></button>
          <button onClick={toggleCollapse} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 truncate text-[11px] text-slate-400 sm:flex">
              <Link href="/" className="hover:text-slate-700">PowerOS</Link>
              {crumbs.map((crumb, i) => <span key={`${crumb}-${i}`} className="inline-flex items-center gap-1"><ChevronRight size={12} /><span className={i === crumbs.length - 1 ? "font-medium text-slate-600" : ""}>{titleCase(crumb)}</span></span>)}
            </nav>
            <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base" aria-current="page">{pageTitle}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setPalOpen(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 hover:border-slate-300 hover:bg-white md:flex" aria-label="Search PowerOS (Control K)"><Search size={14} /><span>Search</span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">Ctrl K</kbd></button>
          {user && <div className="hidden xl:block"><BranchSwitcher branches={branches ?? []} scope={scope} /></div>}
          <div className="relative">
            <button onClick={() => setCreateOpen(v => !v)} aria-expanded={createOpen} aria-label="Quick create" className="flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"><Plus size={15} /><span className="hidden sm:inline">Create</span></button>
            {createOpen && <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              {createItems.length ? createItems.map(item => <Link key={item.href} href={item.href} onClick={() => setCreateOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><item.icon size={15} className="text-slate-400" />{item.label}</Link>) : <p className="p-3 text-xs text-slate-500">No create actions are available for this role.</p>}
            </div>}
          </div>
          <button onClick={() => router.push("/inbox")} aria-label="Open notifications and inbox" title="Notifications and alerts" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Bell size={18} /></button>
          {canSeeApprovals && <button onClick={() => router.push("/transfers/approvals")} aria-label={`${pendingApprovals} pending transfer approvals`} title="Pending transfer approvals" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><ClipboardCheck size={18} />{pendingApprovals > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{pendingApprovals > 99 ? "99+" : pendingApprovals}</span>}</button>}
          {user && <div className="relative">
            <button onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen} className="flex h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#14243b] text-xs font-bold text-white">{(user.name || "U").slice(0,1).toUpperCase()}</span>
              <span className="hidden max-w-28 text-left sm:block"><span className="block truncate text-xs font-semibold text-slate-800">{user.name}</span><span className="block truncate text-[10px] capitalize text-slate-500">{roleLabel}</span></span><ChevronDown size={13} className="hidden text-slate-400 sm:block" />
            </button>
            {profileOpen && <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-xs font-semibold">{user.name}</p><p className="text-[10px] capitalize text-slate-500">{roleLabel}</p></div>
              <Link href="/settings" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Settings</Link>
              <Link href="/support" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Help & Support</Link>
              <form action="/api/logout" method="POST"><button className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">Sign out</button></form>
            </div>}
          </div>}
        </div>
      </header>
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7"><div className="page-content"><ScopeProvider value={scope}>{children}</ScopeProvider></div></main>
      <footer className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-400 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3"><span>© {new Date().getFullYear()} PowerOS</span><span className="hidden sm:inline">·</span><span className="max-w-48 truncate">{tenantName || "Power Eyes Opticals"}</span><span className="hidden md:inline">v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}</span></div>
        <div className="flex items-center gap-3"><Link href="/support" className="hover:text-slate-700">Help & Support</Link><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Application</span></div>
      </footer>
    </div>
    <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} role={user?.role} perms={user?.perms} />
  </div>;
}
