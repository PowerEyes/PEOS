import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { CountUp } from "@poweros/ui";
import { Users, UserPlus, AlertTriangle, IndianRupee, Wrench, CalendarDays } from "lucide-react";
export default async function Dashboard() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("full_name").eq("id", user!.id).single();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const [{ count: totalCustomers }, { count: newCustomers }, { data: todaySales }, { data: stockAlerts }, { data: repairAlerts }, { data: todayAppts }] = await Promise.all([
    sb.from("customers").select("id", { count: "exact", head: true }),
    sb.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    sb.from("sales").select("grand_total").eq("kind","order").neq("status","cancelled").gte("created_at", todayStart.toISOString()),
    sb.from("stock").select("qty, reorder_level").gt("reorder_level", 0),
    sb.from("repairs").select("id").in("status",["pending","in_progress"]),
    sb.from("appointments").select("id, appt_time, customers(full_name), appt_type, status").eq("appt_date", todayStart.toISOString().slice(0,10)).order("appt_time"),
  ]);
  const salesToday = Math.round((todaySales ?? []).reduce((a, r) => a + Number(r.grand_total), 0));
  const lowStock = (stockAlerts ?? []).filter((r) => r.qty <= r.reorder_level).length;
  const activeRepairs = repairAlerts?.length ?? 0;
  const first = (p?.full_name ?? "").split(" ")[0];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-slate-500">Welcome back</p>
        <h1 className="font-display text-4xl font-semibold">{first} 👋</h1>
        <p className="text-slate-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "New customer",    href: "/customers?new=1",    color: "bg-navy-800" },
          { label: "New sale / POS",  href: "/sales?new=1",        color: "bg-gold-500" },
          { label: "New prescription",href: "/prescriptions?new=1",color: "bg-blue-600" },
          { label: "Book eye test",   href: "/appointments?new=1", color: "bg-emerald-600" },
        ].map((a) => (
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
