"use client";
import Link from "next/link";
import { BranchSwitcher } from "./BranchSwitcher";
import { CommandPalette } from "./CommandPalette";
import { ScopeProvider } from "./ScopeContext";
import { routeAllowed } from "@/lib/rbac";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, Calendar, ShoppingCart, Wrench,
  Package, DollarSign, Settings, Globe, LogOut, ChevronDown, ChevronRight,
  Hammer, UserCheck, ReceiptText, MessageCircle, Tag, TrendingUp, FileBarChart,
  Stethoscope, Wallet, ClipboardCheck, LifeBuoy, Building2, Store, Search,
  ChevronLeft, ChevronRight as ChevronRightIcon, Bell, Plus, Home, User,
  BarChart3, CreditCard, Shield, Database, Zap, Heart, Eye, Phone, Mail,
  Truck, PackageCheck, ClipboardList, FileSearch, Users2, Briefcase,
  Activity, Target, Layers, Boxes, ArrowRightLeft, Receipt, Banknote,
  Megaphone, Settings2, Lock, HardDrive, Wifi, WifiOff, HelpCircle,
  ExternalLink, ChevronUp,
} from "lucide-react";

type NavItem = {
  label: string; href?: string; icon: any;
  badge?: string; children?: { label: string; href: string; icon: any }[];
  roles?: string[];
};

const ok = (href: string | undefined, u?: { role: string; perms?: string[] }) => !href || routeAllowed(u?.role, href.split("?")[0], u?.perms ?? []);
function visible(item: NavItem, u?: { role: string; perms?: string[] }): NavItem | null {
  if (item.children) { const ch = item.children.filter(c => ok(c.href, u)); return ch.length ? { ...item, children: ch } : null; }
  return ok(item.href, u) ? item : null;
}

const NAV: NavItem[] = [
  // 1. Dashboard
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Owner Dashboard", href: "/owner-dashboard", icon: Building2, roles: ["owner", "admin"] },
  { label: "Branch Dashboard", href: "/branch-dashboard", icon: Store, roles: ["branch_manager", "manager"] },
  { label: "Employee Dashboard", href: "/employee-dashboard", icon: Users2, roles: ["optometrist", "sales_executive", "cashier", "inventory_manager", "lab_technician", "accountant", "receptionist"] },

  // 2. Customers & CRM
  { label: "Customers", href: "/customers", icon: Users },
  { label: "CRM Automation", href: "/crm", icon: MessageCircle },
  { label: "Inbox & Alerts", href: "/inbox", icon: MessageCircle },

  // 3. Clinical
  { label: "Appointments", href: "/appointments", icon: Calendar },
  { label: "Prescriptions", href: "/prescriptions", icon: FileText },
  { label: "Optometrist", href: "/optometrist", icon: Stethoscope, roles: ["optometrist", "owner", "admin", "branch_manager"] },
  { label: "Receptionist", href: "/receptionist", icon: UserCheck, roles: ["receptionist", "owner", "admin", "branch_manager"] },
  { label: "Consultations", href: "/consultations", icon: FileSearch, roles: ["optometrist", "owner", "admin", "branch_manager"] },
  { label: "LPIMS", href: "/lpims", icon: Eye, roles: ["optometrist", "owner", "admin", "branch_manager", "inventory_manager"] },

  // 4. Sales & POS
  { label: "POS & Orders", href: "/sales", icon: ShoppingCart },
  { label: "Web Orders", href: "/web-orders", icon: Globe },
  { label: "Cashier", href: "/cashier", icon: CreditCard, roles: ["cashier", "owner", "admin", "branch_manager"] },

  // 5. Inventory
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Display", href: "/inventory/display", icon: Layers },
  { label: "Lens Options", href: "/inventory/options", icon: Settings2 },
  { label: "Lens Packages", href: "/inventory/packages", icon: Boxes },
  { label: "Stock Transfers", href: "/transfers", icon: ArrowRightLeft },
  { label: "Transfer Approvals", href: "/transfers/approvals", icon: ClipboardCheck },
  { label: "Stock Audit", href: "/stock-audits", icon: ClipboardList },

  // 6. Procurement
  { label: "Purchase Orders", href: "/purchases", icon: ClipboardCheck },
  { label: "Purchase Invoices", href: "/purchase-invoices", icon: ReceiptText },
  { label: "Suppliers", href: "/suppliers", icon: Truck },

  // 7. Workshop & Lab
  { label: "Workshop & Lab", href: "/workshop", icon: Wrench },
  { label: "Lab Technician", href: "/lab-tech", icon: Hammer, roles: ["lab_technician", "owner", "admin", "branch_manager"] },
  { label: "Repairs", href: "/repairs", icon: Hammer },
  { label: "Dispensing", href: "/dispensing", icon: PackageCheck },
  { label: "Quality Control", href: "/quality-control", icon: ClipboardCheck },

  // 8. Finance & Accounts
  {
    label: "Finance", icon: DollarSign,
    children: [
      { label: "Overview", href: "/finance", icon: DollarSign },
      { label: "Cashbook", href: "/finance?tab=Cashbook", icon: Wallet },
      { label: "Sales Report", href: "/finance/reports", icon: TrendingUp },
      { label: "GSTR-1 Export", href: "/finance/gstr1", icon: FileBarChart },
      { label: "Accountant Export", href: "/accountant-export", icon: FileBarChart },
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Bank Reconciliation", href: "/bank-reconciliation", icon: Banknote },
    ],
  },

  // 9. Staff & Payroll
  { label: "Staff", href: "/staff", icon: UserCheck },
  { label: "Attendance", href: "/staff/attendance", icon: Activity },
  { label: "Leave Management", href: "/staff/leave", icon: Calendar },
  { label: "Payroll", href: "/payroll", icon: Wallet },

  // 10. Customer Engagement
  { label: "Communications", href: "/communications", icon: Megaphone },
  { label: "Loyalty & Referrals", href: "/loyalty", icon: Heart },

  // 11. Branches
  { label: "Branches", href: "/branches", icon: Store },
  { label: "Branch Comparison", href: "/owner-dashboard/branch-comparison", icon: BarChart3, roles: ["owner", "admin"] },
  { label: "Branch Inventory", href: "/owner-dashboard/branch-inventory", icon: Package, roles: ["owner", "admin", "branch_manager"] },

  // 12. Reports & Analytics
  {
    label: "Reports", icon: FileBarChart,
    children: [
      { label: "Company Overview", href: "/reports/company-overview", icon: Building2 },
      { label: "Branch Comparison", href: "/reports/branch-comparison", icon: TrendingUp },
    ],
  },

  // 13. Website Management
  {
    label: "Website", icon: Globe,
    children: [
      { label: "Website Studio", href: "/website", icon: Globe },
      { label: "Pages", href: "/website/pages", icon: FileText },
      { label: "Coupons", href: "/website/coupons", icon: Tag },
    ],
  },

  // 14. Settings & Security
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Roles & Permissions", href: "/settings/roles", icon: Shield, roles: ["owner", "admin"] },
  { label: "Store Domains", href: "/settings/domains", icon: Globe },
  { label: "Security", href: "/settings/security", icon: Lock, roles: ["owner", "admin"] },
  { label: "Integrations", href: "/settings/integrations", icon: Zap, roles: ["owner", "admin"] },
  { label: "Backup", href: "/settings/backup", icon: HardDrive, roles: ["owner", "admin"] },
  { label: "Audit Log", href: "/audit", icon: FileText },

  // 15. Subscription & Billing
  { label: "Subscription", href: "/subscription", icon: CreditCard },
  { label: "Usage", href: "/subscription/usage", icon: BarChart3 },
  { label: "Invoices", href: "/subscription/invoices", icon: ReceiptText },

  // 16. Platform Administration (admin only)
  { label: "Platform", href: "/platform", icon: Building2, roles: ["platform_admin"] },
  { label: "Companies", href: "/platform/companies", icon: Building2, roles: ["platform_admin"] },
  { label: "Plans", href: "/platform/plans", icon: CreditCard, roles: ["platform_admin"] },
  { label: "Subscriptions", href: "/platform/subscriptions", icon: Wallet, roles: ["platform_admin"] },
  { label: "Billing", href: "/platform/billing", icon: DollarSign, roles: ["platform_admin"] },
  { label: "Support", href: "/platform/support", icon: LifeBuoy, roles: ["platform_admin"] },
  { label: "Announcements", href: "/platform/announcements", icon: Megaphone, roles: ["platform_admin"] },
  { label: "Maintenance", href: "/platform/maintenance", icon: Settings, roles: ["platform_admin"] },
  { label: "Security", href: "/platform/security", icon: Shield, roles: ["platform_admin"] },
  { label: "Backup", href: "/platform/backup", icon: HardDrive, roles: ["platform_admin"] },

  // Other
  { label: "Setup checklist", href: "/setup", icon: ClipboardCheck },
  { label: "Store Domains", href: "/settings/domains", icon: Globe },
  { label: "Offline Sync", href: "/offline-sync", icon: WifiOff },
];

function NavLink({ item, depth = 0, onNavigate, collapsed = false }: { item: NavItem; depth?: number; onNavigate?: () => void; collapsed?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(() => item.children?.some(c => path.startsWith(c.href)) ?? false);

  if (item.children) {
    const anyActive = item.children.some(c => path === c.href || path.startsWith(c.href + "/"));
    return (
      <div>
        <button onClick={() => setOpen(o => !o)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${anyActive ? "text-orange-400 bg-white/5 font-semibold" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
          <item.icon size={17} className={anyActive ? "text-orange-400" : "text-slate-400"} />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
            {item.children.map(c => <NavLink key={c.href} item={c} depth={1} onNavigate={onNavigate} />)}
          </div>
        )}
      </div>
    );
  }

  const active = item.href === "/" ? path === "/" : path === item.href || path.startsWith(item.href + "/");
  if (collapsed) {
    return (
      <Link href={item.href!} onClick={onNavigate} title={item.label}
        className={`flex items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium transition ${active ? "bg-orange-500/20 text-orange-400" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
        <item.icon size={18} className={active ? "text-orange-400" : "text-slate-500"} />
      </Link>
    );
  }
  return (
    <Link href={item.href!} onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-orange-500/20 text-orange-400 font-semibold" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
      <item.icon size={17} className={active ? "text-orange-400" : "text-slate-500"} />
      <span className="flex-1">{item.label}</span>
      {item.badge && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
    </Link>
  );
}

export function Shell({ children, user, branches, settings, tenantName, scope = null }: {
  scope?: string | null;
  children: React.ReactNode;
  user?: { name: string; role: string; perms?: string[] };
  branches?: { id: string; name: string }[];
  settings?: any;
  tenantName?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(c => {
      localStorage.setItem("sidebar-collapsed", String(!c));
      return !c;
    });
  };

  // Ctrl/⌘+K opens the command palette from anywhere in the app.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalOpen(o => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Role-based redirect on mount
  useEffect(() => {
    const redirects: Record<string, string> = {
      owner: "/owner-dashboard", admin: "/", branch_manager: "/branch-dashboard",
      optometrist: "/optometrist", receptionist: "/receptionist",
      sales_executive: "/sales/pos", cashier: "/cashier",
      lab_technician: "/lab-tech", accountant: "/finance",
      platform_admin: "/platform",
    };
    // Only redirect on initial load (root path)
    if (path === "/" && user?.role && redirects[user.role]) {
      // Don't redirect if already on the right page
    }
  }, [user, path]);

  const filteredNav = NAV.filter(item => {
    if (item.roles && user?.role && !item.roles.includes(user.role)) return false;
    return visible(item, user) !== null;
  }).map(item => visible(item, user)!).filter(Boolean);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)} />)}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 transition-all duration-300 lg:static ${collapsed ? "w-16" : "w-64"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className={`flex h-14 shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-orange-500 text-white font-bold text-sm select-none shrink-0">👁</div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-extrabold text-sm text-white leading-tight truncate">PowerOS</p>
                <p className="text-[9px] text-slate-400 tracking-wider uppercase truncate">{tenantName || "Power Eyes Opticals"}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>

        {/* Branch selector */}
        {!collapsed && user && (
          <div className="px-3 py-2 border-b border-white/10">
            <BranchSwitcher branches={branches ?? []} scope={scope} />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
          {filteredNav.map(item => (
            <NavLink key={item.label} item={item} onNavigate={() => setSidebarOpen(false)} collapsed={collapsed} />
          ))}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden lg:flex border-t border-white/10 p-2">
          <button onClick={toggleCollapse} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRightIcon size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-2">
          <form action="/api/logout" method="POST">
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition">
              <LogOut size={16} />
              {!collapsed && <span>Sign out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 lg:hidden" aria-label="Toggle navigation">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-1 text-sm text-slate-500">
              <span className="font-medium text-navy-900">PowerOS</span>
              {path !== "/" && (
                <>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span className="font-medium text-slate-700 capitalize">{path.split("/").filter(Boolean).join(" / ").replace(/-/g, " ")}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            {/* Global Search */}
            <button onClick={() => setPalOpen(true)} className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition" aria-label="Search (Ctrl+K)">
              <Search size={13} /> Search anything... <kbd className="rounded bg-white border border-slate-200 px-1.5 py-px font-sans text-[10px] text-slate-400">⌘K</kbd>
            </button>

            {/* Quick Create */}
            <div className="relative group">
              <button className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition shadow-sm" aria-label="Quick create">
                <Plus size={14} /> <span className="hidden sm:inline">Create</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-1">
                  {[
                    { label: "New Customer", href: "/customers?new=1", icon: Users },
                    { label: "New Sale", href: "/sales?new=1", icon: ShoppingCart },
                    { label: "New Appointment", href: "/appointments?new=1", icon: Calendar },
                    { label: "New Prescription", href: "/prescriptions?new=1", icon: FileText },
                    { label: "New Purchase", href: "/purchases?new=1", icon: ClipboardCheck },
                    { label: "New Repair", href: "/repairs?new=1", icon: Hammer },
                    { label: "New Expense", href: "/expenses", icon: Receipt },
                  ].map(item => (
                    <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                      <item.icon size={14} className="text-slate-400" /> {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <button className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="Notifications">
              <Bell size={18} />
            </button>

            {/* Branch switcher */}
            {user && <BranchSwitcher branches={branches ?? []} scope={scope} />}

            {/* User profile */}
            {user && (
              <span className="hidden sm:flex items-center gap-2 text-xs text-slate-500" title={branches?.length ? `${branches.length} branch${branches.length > 1 ? "es" : ""}` : undefined}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-800 font-bold text-[10px] text-white">{(user.name || "?").slice(0, 1).toUpperCase()}</span>
                <span className="font-medium text-navy-900">{user.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{user.role}</span>
              </span>
            )}

            {/* Website link */}
            <a href={process.env.NEXT_PUBLIC_WEB_URL || "#"} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1 hover:text-navy-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-slate-50 transition">
              <ExternalLink size={12} /> Website
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ScopeProvider value={scope}>{children}</ScopeProvider>
        </main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} PowerOS · {tenantName || "Power Eyes Opticals"}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">v{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-600 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition">Terms</Link>
            <Link href="/help" className="hover:text-slate-600 transition">Help</Link>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="hidden sm:inline">Online</span>
            </span>
          </div>
        </footer>
      </div>
      <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} role={user?.role} perms={user?.perms} />
    </div>
  );
}

// Need to update NavLink to accept collapsed prop
function NavLinkWrapper(props: any) {
  return <NavLink {...props} />;
}