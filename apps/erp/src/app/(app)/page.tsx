import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { CountUp } from "@poweros/ui";
import { resolveScope } from "@/lib/branch-scope";
import { landingFor } from "@/lib/landing";
import { routeAllowed } from "@/lib/rbac";
import { inr } from "@poweros/business-rules";
import { Users, UserPlus, AlertTriangle, IndianRupee, Wrench, CalendarDays } from "lucide-react";
export default async function Dashboard({ searchParams }: { searchParams: { d?: string; denied?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: p }, { data: brs }, { data: perms }] = await Promise.all([
    sb.from("profiles").select("full_name, role_key, branch_id").eq("id", user.id).single(),
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.rpc("my_permissions"),
  ]);
  // Role landing: specialists open on their own work screen; "/?d=1" (the Dashboard menu item) and access-denied bounces stay here.
  const home = landingFor(p?.role_key);
  if (home !== "/" && !searchParams?.d && !searchParams?.denied) redirect(home);
  const isOwner = ['owner','admin'].includes(p?.role_key ?? '');
  const { data: liveRow } = isOwner ? await sb.from('org_settings').select('value').eq('key','go_live').maybeSingle() : { data: null };
  const scope = resolveScope(p?.role_key ?? "staff", p?.branch_id ?? null, (brs ?? []).map((b) => b.id));
  const scopeName = scope ? brs?.find((b) => b.id === scope)?.name : "All branches";
  const isMgr = ["owner", "admin", "branch_manager"].includes(p?.role_key ?? "");
  const only = (q: any) => (scope ? q.eq("branch_id", scope) : q);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [{ data: overview }, { data: trend }] = await Promise.all([isMgr ? sb.rpc("branch_overview") : Promise.resolve({ data: [] as any[] }), sb.rpc("sales_trend", { p_branch: scope, p_days: 14 })]);
  const [{ count: totalCustomers }, { count: newCustomers }, { data: todaySales }, { data: stockAlerts }, { data: repairAlerts }, { data: todayAppts }] = await Promise.all([
    sb.from("customers").select("id", { count: "exact", head: true }),
    sb.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    only(sb.from("sales").select("grand_total")).eq("kind","order").neq("status","cancelled").gte("created_at", todayStart.toISOString()),
    only(sb.from("stock").select("qty, reorder_level")).gt("reorder_level", 0),
    only(sb.from("repairs").select("id")).in("status",["pending","in_progress"]),
    only(sb.from("appointments").select("id, appt_time, customers(full_name), appt_type, status")).eq("appt_date", todayStart.toISOString().slice(0,10)).order("appt_time"),
  ]);
  const salesToday = Math.round((todaySales ?? []).reduce((a: number, r: any) => a + Number(r.grand_total), 0));
  const lowStock = (stockAlerts ?? []).filter((r: any) => r.qty <= r.reorder_level).length;
  const activeRepairs = repairAlerts?.length ?? 0;
  const first = (p?.full_name ?? "").split(" ")[0];
  const role = p?.role_key ?? "staff";
  // Role dashboards live in the same shell: each role gets its own quick actions.
  const ROLE_ACTIONS: Record<string, { label: string; href: string; color: string }[]> = {
    owner: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "New prescription", href: "/prescriptions?new=1", color: "bg-blue-600" },
      { label: "Book eye test", href: "/appointments?new=1", color: "bg-emerald-600" },
    ],
    admin: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Staff", href: "/staff", color: "bg-violet-600" },
      { label: "Subscription", href: "/subscription", color: "bg-emerald-600" },
    ],
    branch_manager: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Stock audit", href: "/stock-audits", color: "bg-amber-600" },
      { label: "Branch reports", href: "/reports/branch-comparison", color: "bg-blue-600" },
    ],
    optometrist: [
      { label: "Patient queue", href: "/appointments", color: "bg-navy-800" },
      { label: "New prescription", href: "/prescriptions?new=1", color: "bg-blue-600" },
      { label: "Eye examination", href: "/appointments?exam=1", color: "bg-emerald-600" },
      { label: "Customer 360", href: "/customers", color: "bg-violet-600" },
    ],
    cashier: [
      { label: "POS billing", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Order lookup", href: "/sales", color: "bg-navy-800" },
      { label: "Cashbook", href: "/finance?tab=Cashbook", color: "bg-emerald-600" },
      { label: "Cash closing", href: "/finance?tab=Day Closing", color: "bg-blue-600" },
    ],
    receptionist: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "Appointments", href: "/appointments", color: "bg-emerald-600" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Repairs", href: "/repairs", color: "bg-violet-600" },
    ],
    sales_executive: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Appointments", href: "/appointments", color: "bg-emerald-600" },
      { label: "Web orders", href: "/web-orders", color: "bg-blue-600" },
    ],
    inventory_manager: [
      { label: "Inventory", href: "/inventory", color: "bg-amber-600" },
      { label: "Stock audit", href: "/stock-audits", color: "bg-navy-800" },
      { label: "Transfers", href: "/transfers", color: "bg-blue-600" },
      { label: "Purchase orders", href: "/purchases", color: "bg-emerald-600" },
    ],
    lab_technician: [
      { label: "Workshop & lab", href: "/workshop", color: "bg-navy-800" },
      { label: "Repairs", href: "/repairs", color: "bg-violet-600" },
      { label: "Inventory", href: "/inventory", color: "bg-amber-600" },
      { label: "Appointments", href: "/appointments", color: "bg-emerald-600" },
    ],
    accountant: [
      { label: "Finance", href: "/finance", color: "bg-navy-800" },
      { label: "Cashbook", href: "/finance?tab=Cashbook", color: "bg-emerald-600" },
      { label: "GSTR-1", href: "/finance/gstr1", color: "bg-blue-600" },
      { label: "Accountant export", href: "/accountant-export", color: "bg-gold-500" },
    ],
    staff: [
      { label: "New customer", href: "/customers?new=1", color: "bg-navy-800" },
      { label: "New sale / POS", href: "/sales?new=1", color: "bg-gold-500" },
      { label: "Appointments", href: "/appointments", color: "bg-emerald-600" },
      { label: "Inventory", href: "/inventory", color: "bg-amber-600" },
    ],
  };
  // Render only granted modules: drop any shortcut this role cannot open, so a
  // revoked permission never leaves a tile that bounces to /?denied=1.
  const quickActions = (ROLE_ACTIONS[role] ?? ROLE_ACTIONS.staff)
    .filter((a) => routeAllowed(role, a.href.split("?")[0], perms ?? []));
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {isOwner && !liveRow?.value && <Link href="/setup" className="card block border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Finish setting up your business — open the go-live checklist →</Link>}
      <div>
        <p className="text-slate-500">Welcome back</p>
        <h1 className="font-display text-4xl font-semibold">{first} 👋</h1>
        <p className="text-slate-500"><b className="text-navy-800">{scopeName}</b> · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Users /></span>
          <div><p className="text-sm text-slate-500">Total customers</p><p className="text-3xl font-bold"><CountUp to={totalCustomers ?? 0} /></p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><UserPlus /></span>
          <div><p className="text-sm text-slate-500">New this month</p><p className="text-3xl font-bold"><CountUp to={newCustomers ?? 0} /></p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-600"><IndianRupee /></span>
          <div><p className="text-sm text-slate-500">Sales today</p><p className="text-3xl font-bold">₹<CountUp to={salesToday} /></p></div>
        </div>
        <Link href="/inventory?stock=low" className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle /></span>
          <div><p className="text-sm text-slate-500">Low stock items</p><p className="text-3xl font-bold"><CountUp to={lowStock} /></p></div>
        </Link>
        <Link href="/repairs" className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose-50 text-rose-600"><Wrench /></span>
          <div><p className="text-sm text-slate-500">Active repairs</p><p className="text-3xl font-bold"><CountUp to={activeRepairs} /></p></div>
        </Link>
      </div>

      {/* Sales trend */}
      {(trend ?? []).length > 0 && (() => { const max = Math.max(1, ...(trend ?? []).map((t: any) => Number(t.amount))); const tot = (trend ?? []).reduce((a: number, t: any) => a + Number(t.amount), 0);
        return (<div className="card p-5"><div className="mb-3 flex items-end justify-between"><p className="font-semibold">Sales, last 14 days</p><p className="text-sm text-slate-500">{inr(Math.round(tot))}</p></div>
          <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Daily sales for the last 14 days">{(trend ?? []).map((t: any) => (
            <div key={t.day} className="group relative flex-1" title={`${t.day}: ${inr(Number(t.amount))} (${t.orders} orders)`}><div className="w-full rounded-t bg-navy-700/80 transition group-hover:bg-gold-500" style={{ height: `${Math.max(3, (Number(t.amount) / max) * 100)}%` }} /></div>))}</div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{(trend as any)[0].day.slice(5)}</span><span>{(trend as any)[(trend as any).length - 1].day.slice(5)}</span></div></div>); })()}

      {/* All-branch comparison (managers, owners, admins) */}
      {isMgr && (overview ?? []).length > 1 && (
        <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="font-semibold">Branch comparison</p><p className="text-xs text-slate-500">Click a branch to focus the whole app on it.</p></div><Link href="/branches" className="text-sm font-medium text-navy-700 underline shrink-0">View all branches</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Branch</th><th className="px-3 py-2 text-right">Today</th><th className="px-3 py-2 text-right">This month</th><th className="px-3 py-2 text-right">Collected</th><th className="px-3 py-2 text-right">Lab queue</th><th className="px-3 py-2 text-right">Repairs</th><th className="px-3 py-2 text-right">Low stock</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(overview ?? []).map((r: any) => (<tr key={r.branch_id} className={r.branch_id === scope ? "bg-gold-50" : ""}>
              <td className="px-4 py-2.5 font-medium text-navy-900">{r.branch}</td><td className="px-3 py-2.5 text-right">{inr(Number(r.today_sales))}<span className="block text-[10px] text-slate-400">{r.today_orders} orders</span></td>
              <td className="px-3 py-2.5 text-right">{inr(Number(r.month_sales))}<span className="block text-[10px] text-slate-400">{r.month_orders} orders</span></td><td className="px-3 py-2.5 text-right">{inr(Number(r.month_collected))}</td>
              <td className="px-3 py-2.5 text-right">{r.lab_pending}</td><td className="px-3 py-2.5 text-right">{r.open_repairs}</td><td className={`px-3 py-2.5 text-right ${r.low_stock ? "font-semibold text-amber-600" : ""}`}>{r.low_stock}</td></tr>))}</tbody>
            <tfoot className="bg-slate-50 font-semibold"><tr><td className="px-4 py-2.5">All branches</td><td className="px-3 py-2.5 text-right">{inr((overview ?? []).reduce((a: number, r: any) => a + Number(r.today_sales), 0))}</td><td className="px-3 py-2.5 text-right">{inr((overview ?? []).reduce((a: number, r: any) => a + Number(r.month_sales), 0))}</td><td className="px-3 py-2.5 text-right">{inr((overview ?? []).reduce((a: number, r: any) => a + Number(r.month_collected), 0))}</td><td className="px-3 py-2.5 text-right">{(overview ?? []).reduce((a: number, r: any) => a + r.lab_pending, 0)}</td><td className="px-3 py-2.5 text-right">{(overview ?? []).reduce((a: number, r: any) => a + r.open_repairs, 0)}</td><td className="px-3 py-2.5 text-right">{(overview ?? []).reduce((a: number, r: any) => a + r.low_stock, 0)}</td></tr></tfoot></table></div></div>)}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((a) => (
          <Link key={a.label} href={a.href} className={`${a.color} btn text-white !py-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:opacity-90`}>{a.label}</Link>
        ))}
      </div>

      {/* Today's appointments */}
      {(todayAppts ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold flex items-center gap-2"><CalendarDays size={16} />Today&apos;s appointments</p>
            <Link href="/appointments" className="text-sm text-navy-700 underline">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(todayAppts ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <span className="w-14 font-medium text-navy-700">{a.appt_time?.slice(0,5)}</span>
                <span className="flex-1"><b>{a.customers?.full_name}</b> <span className="text-slate-500">— {a.appt_type}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${a.status === "confirmed" ? "bg-blue-50 text-blue-700" : a.status === "arrived" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">More modules — Finance, Workshop, Repairs — are in the sidebar or use Ctrl+K to jump anywhere.</p>
    </div>
  );
}
