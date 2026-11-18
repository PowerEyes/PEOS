
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { Bell, Package, FileText, Calendar, Star, Gift, AlertCircle } from "lucide-react";

const ICON_MAP: Record<string, any> = {
  order: Package, prescription: FileText, appointment: Calendar,
  loyalty: Gift, review: Star, system: AlertCircle,
};

const COLOR_MAP: Record<string, string> = {
  order:        "bg-blue-50 text-blue-600 border-blue-100",
  prescription: "bg-purple-50 text-purple-600 border-purple-100",
  appointment:  "bg-gold-50 text-gold-600 border-gold-100",
  loyalty:      "bg-emerald-50 text-emerald-600 border-emerald-100",
  review:       "bg-amber-50 text-amber-600 border-amber-100",
  system:       "bg-slate-50 text-slate-500 border-slate-100",
};

const dStr = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
};

export default async function NotificationsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");
  const { data: c } = await sb.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!c) redirect("/my/login");

  // Pull recent activity to build a notification feed
  const [orders, rxs, appts, loyalty] = await Promise.all([
    sb.from("sales").select("id,code,status,created_at,grand_total").eq("customer_id", c.id).eq("kind","order").order("created_at",{ascending:false}).limit(5),
    sb.from("prescriptions").select("id,rx_code,rx_date,valid_till").eq("customer_id", c.id).order("rx_date",{ascending:false}).limit(3),
    sb.from("appointments").select("id,appointment_date,status").eq("customer_id", c.id).order("appointment_date",{ascending:false}).limit(3),
    sb.from("loyalty_ledger").select("id,delta,reason,created_at").eq("customer_id", c.id).order("created_at",{ascending:false}).limit(5),
  ]);

  // Build unified notification feed from real events
  type Notif = { id:string; type:string; title:string; body:string; ts:string; link?:string; unread:boolean };
  const notifs: Notif[] = [];

  (orders.data ?? []).forEach(o => {
    const statusMsg: Record<string,string> = {
      draft:"Order placed successfully.", processing:"Your order is being prepared.",
      lab_pending:"Your lenses are at the lab.",in_workshop:"Your order is in the workshop.",
      qc:"Your order is in quality check.",ready:"Your order is ready for pickup!",
      delivered:"Your order has been delivered.",cancelled:"Your order was cancelled.",
    };
    notifs.push({ id:`ord-${o.id}`, type:"order", unread: o.status === "ready" || o.status === "delivered",
      title:`Order #${o.code}`, body: statusMsg[o.status ?? "draft"] ?? `Status: ${o.status}`,
      ts: o.created_at, link:`/my/orders/${o.id}` });
  });

  (rxs.data ?? []).forEach(rx => {
    if (!rx.valid_till) return;
    const days = Math.floor((new Date(rx.valid_till).getTime() - Date.now()) / 86400000);
    if (days < 90) {
      notifs.push({ id:`rx-${rx.id}`, type:"prescription", unread: days < 30,
        title:"Prescription expiring soon",
        body: days < 0 ? `Your prescription ${rx.rx_code} has expired. Book an eye test to renew.`
                       : `Your prescription ${rx.rx_code} expires in ${days} days. Book your eye test early.`,
        ts: rx.rx_date, link:"/my/prescriptions" });
    }
  });

  (appts.data ?? []).forEach(a => {
    notifs.push({ id:`apt-${a.id}`, type:"appointment", unread: false,
      title:"Eye test appointment",
      body: `${a.status === "confirmed" ? "Confirmed" : "Appointment"} on ${new Date(a.appointment_date).toLocaleDateString("en-IN",{dateStyle:"medium"})}`,
      ts: a.appointment_date, link:"/my/appointments" });
  });

  (loyalty.data ?? []).forEach(l => {
    notifs.push({ id:`loy-${l.id}`, type:"loyalty", unread: false,
      title: Number(l.delta) > 0 ? `+${l.delta} points earned` : `${l.delta} points redeemed`,
      body: (l.reason ?? "").replace(/_/g," "),
      ts: l.created_at, link:"/my/loyalty" });
  });

  // Sort by timestamp descending
  notifs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const unreadCount = notifs.filter(n => n.unread).length;

  return (
    <PortalLayout activePath="/my/notifications">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-7 py-9 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-extrabold text-3xl flex items-center gap-3">
              NOTIFICATIONS
              {unreadCount > 0 && <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-sm font-bold">{unreadCount}</span>}
            </h1>
            <p className="text-slate-300 mt-1">Order updates, prescription reminders and loyalty points.</p>
          </div>
          <Bell size={36} className="text-white/20 shrink-0"/>
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
          <Bell size={40} className="mx-auto mb-3 text-slate-200"/>
          <p className="font-semibold text-slate-600">No notifications yet</p>
          <p className="text-sm text-slate-400 mt-1">Place an order or book an eye test to see updates here.</p>
          <Link href="/eyeglasses" className="mt-4 inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Shop Eyewear</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unread first */}
          {unreadCount > 0 && (
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">New</p>)}
          {notifs.filter(n => n.unread).map(n => <NotifCard key={n.id} n={n}/>)}
          {unreadCount > 0 && notifs.some(n => !n.unread) && (
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 pt-2">Earlier</p>)}
          {notifs.filter(n => !n.unread).map(n => <NotifCard key={n.id} n={n}/>)}
        </div>)}

      {/* Preferences */}
      <div className="mt-8 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
        <p className="font-bold text-navy-900 mb-3">Notification Preferences</p>
        <div className="space-y-3">
          {[["Order status updates","Shipped, ready for pickup, delivered","order",true],
            ["Prescription reminders","30 days before your Rx expires","prescription",true],
            ["Loyalty points","When you earn or redeem points","loyalty",true],
            ["Offers and promotions","New arrivals, sales and exclusive deals","system",false]].map(([t,s,_type,on])=>(
            <div key={t as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div><p className="text-sm font-medium text-navy-900">{t}</p><p className="text-xs text-slate-400">{s}</p></div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" defaultChecked={on as boolean} className="peer sr-only"/>
                <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-navy-700 peer-checked:after:translate-x-4"/>
              </label>
            </div>))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Notification delivery via WhatsApp is coming soon.</p>
      </div>
    </PortalLayout>);
}

function NotifCard({ n }: { n: any }) {
  const Icon = ICON_MAP[n.type] ?? Bell;
  const color = COLOR_MAP[n.type] ?? COLOR_MAP.system;
  return (
    <Link href={n.link ?? "#"}
      className={`flex items-start gap-4 rounded-2xl bg-white border shadow-sm p-4 transition hover:shadow-md ${n.unread ? "border-navy-100 bg-navy-50/30" : "border-slate-100"}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${color}`}>
        <Icon size={18}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${n.unread ? "text-navy-900" : "text-slate-700"}`}>{n.title}</p>
          <span className="text-[11px] text-slate-400 shrink-0">{dStr(n.ts)}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
      </div>
      {n.unread && <span className="h-2 w-2 rounded-full bg-gold-500 shrink-0 mt-1.5"/>}
    </Link>);
}
