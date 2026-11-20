
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { ShoppingBag, Shield, RotateCcw } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const dStr = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

function warrantyInfo(purchaseDate: string) {
  const exp = new Date(purchaseDate); exp.setFullYear(exp.getFullYear() + 1);
  const daysLeft = Math.floor((exp.getTime() - Date.now()) / 86400000);
  return { active: daysLeft > 0, expiry: dStr(exp.toISOString()), daysLeft };
}

export default async function EyewearPage() {
  const site = await getSiteSettings();
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");
  const { data: c } = await sb.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!c) redirect("/my/login");

  const { data: orders } = await sb.from("sales")
    .select("id,code,status,created_at,grand_total,sale_lines(id,description,line_type,line_total,qty,details)")
    .eq("customer_id", c.id).eq("kind","order").in("status",["delivered","ready"])
    .order("created_at", { ascending: false }).limit(20);

  // Extract frame lines only
  const eyewearItems = (orders ?? []).flatMap(o =>
    (o.sale_lines as any[])
      .filter(l => l.line_type !== "lens" && l.line_type !== "addon")
      .map(l => ({ ...l, orderId: o.id, orderCode: o.code, orderDate: o.created_at, orderStatus: o.status }))
  );

  const totalItems = eyewearItems.length;
  const activeWarranties = eyewearItems.filter(i => warrantyInfo(i.orderDate).active).length;

  return (
    <PortalLayout activePath="/my/eyewear">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-7 py-9 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-extrabold text-3xl">MY EYEWEAR</h1>
            <p className="text-slate-300 mt-1">All frames and eyewear purchased from Power Eyes Opticals.</p>
          </div>
          <ShoppingBag size={36} className="text-white/20 shrink-0"/>
        </div>
        <div className="mt-5 flex flex-wrap gap-5">
          <div><p className="text-xs text-slate-400">Total Items</p><p className="font-extrabold text-2xl">{totalItems}</p></div>
          <div><p className="text-xs text-slate-400">Active Warranties</p><p className="font-extrabold text-2xl text-emerald-400">{activeWarranties}</p></div>
        </div>
      </div>

      {eyewearItems.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
          <ShoppingBag size={40} className="mx-auto mb-3 text-slate-200"/>
          <p className="font-semibold text-slate-600">No eyewear purchased yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Your frames will appear here after delivery.</p>
          <Link href="/eyeglasses" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Shop Eyeglasses</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {eyewearItems.map(item => {
            const w = warrantyInfo(item.orderDate);
            return (
              <div key={item.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 sm:p-5">
                  {/* Frame icon */}
                  <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl sm:text-3xl">👓</div>
                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-navy-900">{item.description}</p>
                        {item.details && <p className="text-xs text-slate-500 mt-0.5">{item.details}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">Order #{item.orderCode} · {dStr(item.orderDate)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1 ${w.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <Shield size={11}/>{w.active ? `Warranty until ${w.expiry}` : "Warranty expired"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-navy-900">{inr(item.line_total)}</p>
                    {/* Warranty bar */}
                    {w.active && (
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Warranty active</span>
                          <span>{w.daysLeft} days remaining</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div className={`h-full rounded-full transition-all ${w.daysLeft > 180 ? "bg-emerald-500" : w.daysLeft > 60 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${Math.min(100, (w.daysLeft / 365) * 100)}%` }}/>
                        </div>
                      </div>)}
                  </div>
                </div>
                {/* Actions */}
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap gap-2">
                  <Link href={`/my/orders/${item.orderId}`}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                    View Order
                  </Link>
                  {w.active && (
                    <a href={waHref(site.whatsappNumber, `I need warranty service for ${item.description} from order ${item.orderCode}`)}
                      target="_blank" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                      <Shield size={12} className="inline mr-1"/>Warranty Claim
                    </a>)}
                  <a href={waHref(site.whatsappNumber, `I need a replacement for ${item.description} from order ${item.orderCode}`)}
                    target="_blank" className="rounded-lg bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 transition">
                    <RotateCcw size={12} className="inline mr-1"/>Reorder This Frame
                  </a>
                </div>
              </div>);})}
        </div>)}

      {/* Care tips */}
      <div className="mt-6 rounded-2xl bg-gold-50 border border-gold-100 p-5 text-sm">
        <p className="font-bold text-navy-900 mb-3">Eyewear Care Tips</p>
        <div className="grid sm:grid-cols-2 gap-2 text-slate-600 text-xs">
          {["Clean lenses with the microfibre cloth provided — never paper or clothing","Always keep your glasses in the case when not wearing them","Visit us for free adjustments if the fit changes — this is included forever","Rinse with water before wiping if lenses are dusty to avoid micro-scratches","Keep away from extreme heat (car dashboards) to protect lens coatings"].map(t=>(
            <p key={t} className="flex items-start gap-1.5"><span className="text-gold-600 mt-0.5 shrink-0">✓</span>{t}</p>))}
        </div>
      </div>
    </PortalLayout>);
}
