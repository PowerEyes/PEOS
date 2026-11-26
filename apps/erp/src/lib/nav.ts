import {
  LayoutDashboard, Users, MessageCircle, Bell, Calendar, FileText, FileSearch, Eye, ShoppingCart, Globe, Package, ArrowRightLeft,
  ClipboardCheck, ClipboardList, ReceiptText, Truck, Wrench, PackageCheck, Hammer, DollarSign, TrendingUp, FileBarChart, Receipt, Banknote,
  UserCheck, Activity, Wallet, Megaphone, Heart, Store, BarChart3, Building2, Tag, Settings, Shield, Lock, Zap, HardDrive, History,
  CreditCard, LifeBuoy, Gauge, SlidersHorizontal, PackagePlus, type LucideIcon,
} from "lucide-react";
import { routeAllowed, specialistAllowed } from "./rbac";

export type BadgeKey = "web-orders" | "transfer-approvals" | "stock-audits" | "repairs" | "inventory" | "inbox";
export type NavLeaf = { label: string; href: string; icon: LucideIcon; badge?: BadgeKey };
export type NavGroup = { key: string; label: string; icon: LucideIcon; items: NavLeaf[]; platform?: boolean };

// Single typed source for sidebar, breadcrumbs and role landing. Every href is an existing route.
export const NAV: NavGroup[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, items: [{ label: "Overview", href: "/", icon: LayoutDashboard }] },
  { key: "crm", label: "Customers & CRM", icon: Users, items: [
    { label: "Customers", href: "/customers", icon: Users }, { label: "CRM automation", href: "/crm", icon: MessageCircle }, { label: "Inbox & alerts", href: "/inbox", icon: Bell, badge: "inbox" }] },
  { key: "clinical", label: "Clinical", icon: Eye, items: [
    { label: "Appointments", href: "/appointments", icon: Calendar }, { label: "Prescriptions", href: "/prescriptions", icon: FileText },
    { label: "Consultations", href: "/consultations", icon: FileSearch }, { label: "LPIMS", href: "/lpims", icon: Eye }] },
  { key: "sales", label: "Sales & POS", icon: ShoppingCart, items: [
    { label: "Sales & POS", href: "/sales", icon: ShoppingCart }, { label: "Website orders", href: "/web-orders", icon: Globe, badge: "web-orders" }] },
  { key: "inventory", label: "Inventory", icon: Package, items: [
    { label: "Inventory", href: "/inventory", icon: Package, badge: "inventory" }, { label: "Stock transfers", href: "/transfers", icon: ArrowRightLeft },
    { label: "Transfer approvals", href: "/transfers/approvals", icon: ClipboardCheck, badge: "transfer-approvals" }, { label: "Stock audits", href: "/stock-audits", icon: ClipboardList, badge: "stock-audits" },
    { label: "Stock adjustments", href: "/stock-adjustments", icon: SlidersHorizontal },
    { label: "Opening stock", href: "/opening-stock", icon: PackagePlus }] },
  { key: "procurement", label: "Procurement", icon: Truck, items: [
    { label: "Purchase orders", href: "/purchases", icon: ClipboardCheck }, { label: "Purchase invoices", href: "/purchase-invoices", icon: ReceiptText }, { label: "Suppliers", href: "/suppliers", icon: Truck }] },
  { key: "workshop", label: "Workshop & Lab", icon: Wrench, items: [
    { label: "Workshop", href: "/workshop", icon: Wrench },
{ label: "Repairs", href: "/repairs", icon: Hammer, badge: "repairs" }] },
  { key: "finance", label: "Finance & Accounts", icon: DollarSign, items: [
    { label: "Overview & cashbook", href: "/finance", icon: DollarSign }, { label: "Sales report", href: "/finance/reports", icon: TrendingUp }, { label: "GSTR-1", href: "/finance/gstr1", icon: FileBarChart },
    { label: "Accountant export", href: "/accountant-export", icon: FileBarChart }, { label: "Bank reconciliation", href: "/bank-reconciliation", icon: Banknote }] },
  { key: "staff", label: "Staff & Payroll", icon: UserCheck, items: [
    { label: "Staff", href: "/staff", icon: UserCheck }, { label: "Attendance", href: "/staff/attendance", icon: Calendar },
    { label: "Leave", href: "/staff/leave", icon: FileText }, { label: "Payroll", href: "/payroll", icon: DollarSign },
    { label: "My payslips", href: "/payroll/mine", icon: ReceiptText }] },
  { key: "engagement", label: "Customer Engagement", icon: Megaphone, items: [
    { label: "Loyalty & referrals", href: "/loyalty", icon: Heart }] },
  { key: "branches", label: "Branches", icon: Store, items: [{ label: "Branches", href: "/branches", icon: Store }] },
  { key: "reports", label: "Reports & Analytics", icon: BarChart3, items: [
    { label: "Company overview", href: "/reports/company-overview", icon: Building2 }, { label: "Branch comparison", href: "/reports/branch-comparison", icon: BarChart3 }] },
  { key: "website", label: "Website", icon: Globe, items: [
    { label: "Website studio", href: "/website", icon: Globe }, { label: "Pages", href: "/website/pages", icon: FileText }, { label: "Coupons", href: "/website/coupons", icon: Tag }] },
  { key: "settings", label: "Settings & Security", icon: Settings, items: [
    { label: "Settings", href: "/settings", icon: Settings }, { label: "Roles & permissions", href: "/settings/roles", icon: Shield }, { label: "Store domains", href: "/settings/domains", icon: Globe },
    { label: "Integrations", href: "/settings/integrations", icon: Zap }, { label: "Backup", href: "/settings/backup", icon: HardDrive },
    { label: "Company profile", href: "/company", icon: Building2 }, { label: "Audit log", href: "/audit", icon: History }, { label: "Go-live checklist", href: "/setup", icon: ClipboardCheck }] },
  { key: "subscription", label: "Subscription & Billing", icon: CreditCard, items: [
    { label: "Subscription", href: "/subscription", icon: CreditCard }, { label: "Usage", href: "/subscription/usage", icon: Gauge }, { label: "Invoices", href: "/subscription/invoices", icon: ReceiptText }] },
  { key: "platform", label: "Platform Administration", icon: Building2, platform: true, items: [
    { label: "Platform", href: "/platform", icon: Building2 }, { label: "Companies", href: "/platform/companies", icon: Store }, { label: "Plans", href: "/platform/plans", icon: CreditCard },
    { label: "Subscriptions", href: "/platform/subscriptions", icon: Wallet }, { label: "Billing", href: "/platform/billing", icon: DollarSign }, { label: "Support", href: "/platform/support", icon: LifeBuoy },
    { label: "Announcements", href: "/platform/announcements", icon: Megaphone }, { label: "Maintenance", href: "/platform/maintenance", icon: Settings }, { label: "Security", href: "/platform/security", icon: Shield },
    { label: "Backup", href: "/platform/backup", icon: HardDrive }] },
];

export type NavUser = { role: string; perms?: string[]; platform?: boolean };
/** Groups/items this user may open. Platform items follow platform_users, not tenant roles. */
export function visibleNav(u: NavUser): NavGroup[] {
  return NAV.filter((g) => !g.platform || u.platform).map((g) => ({
    ...g, items: g.items.filter((i) => g.platform || (routeAllowed(u.role, i.href, u.perms ?? []) && specialistAllowed(u.role, i.href))),
  })).filter((g) => g.items.length);
}
const seg = (s: string) => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
/** Breadcrumb trail from the route hierarchy: group › page › (detail). */
export function crumbsFor(path: string): { label: string; href?: string }[] {
  let best: { g: NavGroup; i: NavLeaf } | null = null;
  for (const g of NAV) for (const i of g.items) if ((i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/")) && (!best || i.href.length > best.i.href.length)) best = { g, i };
  if (!best) return path.split("/").filter(Boolean).map((s, n, a) => ({ label: seg(s), href: n < a.length - 1 ? "/" + a.slice(0, n + 1).join("/") : undefined }));
  const out: { label: string; href?: string }[] = [];
  if (best.g.items.length > 1 || best.g.label !== best.i.label) out.push({ label: best.g.label });
  out.push({ label: best.i.label, href: path !== best.i.href ? best.i.href : undefined });
  if (path !== best.i.href && best.i.href !== "/") out.push({ label: "Details" });
  return out;
}
