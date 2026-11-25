import Link from "next/link";
import { FileText, ShoppingBag, CalendarDays, Shield, Star } from "lucide-react";
import { getCustomer } from "@/lib/customer";
import { supabaseServer } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

export default async function PortalDashboard() {
  const site = await getSiteSettings();
  const customer = await getCustomer();

  // Live counts for THIS customer — no placeholder values.
  let stats = { rx: 0, orders: 0, upcoming: 0, warranty: 0, points: 0 };
  let statsUnavailable = false;
  if (customer) {
    const sb = supabaseServer();
    const cid = customer.id;
    const today = new Date().toISOString().slice(0, 10);
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();

    const [rx, orders, upcoming, warranty, ledger] = await Promise.all([
      // Active prescriptions: not expired (or no expiry) and still active.
      sb.from("prescriptions").select("id", { count: "exact", head: true })
        .eq("customer_id", cid).eq("status", "active")
        .or(`valid_till.is.null,valid_till.gte.${today}`),
      // Orders placed (all time).
      sb.from("sales").select("id", { count: "exact", head: true })
        .eq("customer_id", cid).eq("kind", "order"),
      // Upcoming eye tests: future appointments not cancelled/no-show.
      sb.from("appointments").select("id", { count: "exact", head: true })
        .eq("customer_id", cid).gte("appt_date", today)
        .in("status", ["scheduled", "confirmed"]),
      // Warranty active: delivered orders within the last 12 months
      // (same rule the /my/warranty page uses).
      sb.from("sales").select("id", { count: "exact", head: true })
        .eq("customer_id", cid).eq("kind", "order").eq("status", "delivered")
        .gte("created_at", yearAgo),
      // Loyalty balance: sum of every ledger entry for this customer.
      sb.from("loyalty_ledger").select("delta").eq("customer_id", cid).limit(1000),
    ]);

    statsUnavailable = Boolean(rx.error || orders.error || upcoming.error || warranty.error || ledger.error);
    stats = {
      rx: rx.count ?? 0,
      orders: orders.count ?? 0,
      upcoming: upcoming.count ?? 0,
      warranty: warranty.count ?? 0,
      points: (ledger.data ?? []).reduce((sum, row) => sum + Number(row.delta ?? 0), 0),
    };
  }

  const firstName = customer?.full_name?.trim().split(" ")[0];
  const cards: any[] = [
    [FileText, stats.rx, "Active Prescriptions"],
    [ShoppingBag, stats.orders, "Orders Placed"],
    [CalendarDays, stats.upcoming, "Upcoming Eye Test"],
    [Shield, stats.warranty, "Warranty Active"],
    [Star, stats.points, "Loyalty Points"],
  ];

  return (<div className="space-y-6">
    <div className="rounded-3xl bg-gradient-to-r from-navy-900 to-navy-700 p-8 text-white relative overflow-hidden">
      <p className="text-gold-400 text-sm font-semibold uppercase tracking-wider">Welcome back</p>
      <h1 className="font-display text-4xl font-bold mt-1">{firstName ? `Welcome, ${firstName}!` : "Welcome!"}</h1>
      <p className="text-slate-300 mt-1">Clearer Vision. Brighter Days. For You and Your Family.</p>
      <Link href="/eye-test" className="btn-gold mt-5 inline-flex">Book an Eye Test →</Link>
      {customer && (customer.customer_code || customer.vision_id) && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {customer.customer_code && <span className="rounded-full bg-white/10 px-3 py-1">Customer ID: {customer.customer_code}</span>}
          {customer.vision_id && <span className="rounded-full bg-white/10 px-3 py-1">Vision ID: {customer.vision_id}</span>}
        </div>
      )}
    </div>
    {statsUnavailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Some account metrics could not be loaded. Values may be incomplete; refresh the page or contact support if this continues.</div>}
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2.5 sm:gap-3">
      {cards.map(([I,n,l]: any) => (
        <div key={l as string} className="card p-3 sm:p-4 text-center">
          <I size={18} className="mx-auto text-gold-500 mb-1 sm:h-5 sm:w-5"/>
          <p className="text-xl sm:text-2xl font-bold text-navy-900">{n as number}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-tight">{l as string}</p>
        </div>))}
    </div>
    <div><p className="font-semibold text-navy-900 mb-3 text-sm sm:text-base">Quick Actions</p>
      <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-8 gap-2.5 sm:gap-3">
        {[["Book Eye Test","/eye-test","📅"],["Upload Rx","/my/prescriptions","📋"],["Eyeglasses","/eyeglasses","🕶️"],["Sunglasses","/sunglasses","😎"],["Reorder","/my/reorder","🔄"],["Track Order","/my/orders","🚚"],["Repair Service","/my/repairs","🔧"],["WhatsApp",waHref(site.whatsappNumber),"💬"]].map(([l,h,e])=>(
          <Link key={l as string} href={h as string} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-white p-3 text-center text-xs font-medium text-slate-700 hover:border-gold-400 hover:bg-amber-50 transition min-h-[76px]">
            <span className="text-xl sm:text-2xl">{e as string}</span><span className="leading-tight">{l as string}</span></Link>))}
      </div></div>
    <p className="text-xs text-slate-400">Figures above are generated live from your Power Eyes account records.</p>
  </div>);
}
