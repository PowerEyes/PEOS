
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ChevronLeft, Package, MapPin, CreditCard, Phone, Check, Clock, Truck, Star } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const inr = (n: any) => `₹${Number(n||0).toLocaleString("en-IN")}`;
const dStr = (d: string) => d ? new Date(d).toLocaleDateString("en-IN",{dateStyle:"medium"}) : "—";

const STATUS_STEPS = [
  { key:"draft",       label:"Order Placed",     icon:Check },
  { key:"processing",  label:"Being Prepared",   icon:Clock },
  { key:"lab_pending", label:"At the Lab",       icon:Star  },
  { key:"in_workshop", label:"In Workshop",      icon:Star  },
  { key:"qc",          label:"Quality Check",    icon:Check },
  { key:"ready",       label:"Ready for Pickup", icon:Package },
  { key:"delivered",   label:"Delivered",        icon:Truck },
];

const STATUS_COLOR: Record<string,string> = {
  delivered:"text-emerald-600 bg-emerald-50 border-emerald-200",
  ready:"text-emerald-700 bg-emerald-50 border-emerald-200",
  shipped:"text-blue-600 bg-blue-50 border-blue-200",
  cancelled:"text-rose-600 bg-rose-50 border-rose-200",
  processing:"text-amber-600 bg-amber-50 border-amber-200",
  lab_pending:"text-violet-600 bg-violet-50 border-violet-200",
  in_workshop:"text-violet-600 bg-violet-50 border-violet-200",
  qc:"text-orange-600 bg-orange-50 border-orange-200",
  draft:"text-slate-600 bg-slate-50 border-slate-200",
};

const STEP_ORDER = ["draft","processing","lab_pending","in_workshop","qc","ready","delivered"];

const STATUS_LABEL: Record<string,string> = {
  draft:"Order Placed", sent:"Order Placed", processing:"Being Prepared", lab_pending:"At the Lab",
  in_workshop:"In Workshop", qc:"Quality Check", ready:"Ready for Pickup", delivered:"Delivered",
  cancelled:"Cancelled", converted:"Converted",
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const site = await getSiteSettings();
  const sb = supabaseServer();
  const { data:{ user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");

  const { data: customer } = await sb.from("customers").select("id,full_name,phone").eq("auth_user_id", user.id).maybeSingle();
  if (!customer) redirect("/my/login");

  const [{ data: order }, { data: events }] = await Promise.all([
    sb.from("sales")
      .select("id,code,status,payment_status,grand_total,paid_total,needs_lab,created_at,notes,supply_type,sale_lines(id,description,details,qty,line_total,line_type),payments(amount,method,reference,paid_at)")
      .eq("id", params.id).eq("customer_id", customer.id).eq("kind","order").maybeSingle(),
    sb.from("sale_events").select("from_status,to_status,note,at")
      .eq("sale_id", params.id).order("at", { ascending: true }),
  ]);

  if (!order) notFound();

  const st = order.status ?? "draft";
  const balance = Number(order.grand_total) - Number(order.paid_total);
  const currentStepIdx = STEP_ORDER.indexOf(st);
  const isCancelled = st === "cancelled";
  const isDelivered = st === "delivered";

  return (
    <PortalLayout activePath="/my/orders">
      <LiveRefresh seconds={30} />
      {/* Back link */}
      <Link href="/my/orders" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700 mb-5 transition">
        <ChevronLeft size={16}/>Back to My Orders
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-8 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs mb-1">Order Number</p>
            <h1 className="font-bold text-2xl">#{order.code}</h1>
            <p className="text-slate-300 text-sm mt-1">Placed on {dStr(order.created_at)}</p>
          </div>
          <span className={`rounded-full border px-4 py-1.5 text-sm font-bold capitalize ${STATUS_COLOR[st]}`}>
            {st.replace("_"," ")}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Left: Status + Items */}
        <div className="space-y-5">
          {/* Status stepper */}
          {!isCancelled && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <p className="font-bold text-navy-900 mb-5">Order Status</p>
              <div className="relative">
                {/* Connecting line */}
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-slate-200"/>
                <div className="space-y-5">
                  {STATUS_STEPS.filter(s => STEP_ORDER.includes(s.key)).map((s, i) => {
                    const stepIdx = STEP_ORDER.indexOf(s.key);
                    const done = currentStepIdx >= stepIdx;
                    const current = currentStepIdx === stepIdx;
                    return (
                      <div key={s.key} className="flex items-center gap-4 relative">
                        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 z-10 transition ${done ? "bg-navy-800 border-navy-800 text-white" : "bg-white border-slate-200 text-slate-300"}`}>
                          {done ? <Check size={13}/> : <s.icon size={13}/>}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${done ? "text-navy-900" : "text-slate-400"}`}>{s.label}</p>
                          {current && <p className="text-xs text-gold-600 font-medium">Current status</p>}
                        </div>
                        {current && <span className="h-2 w-2 rounded-full bg-gold-500 animate-pulse shrink-0"/>}
                      </div>);
                  })}
                </div>
              </div>
              {isDelivered && (
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
                  ✓ Your order has been delivered. We hope you love your new eyewear!
                </div>)}
              {order.needs_lab && !isDelivered && (
                <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                  🔭 Your prescription lenses are being prepared at the lab. We'll notify you when ready.
                </div>)}
            </div>)}

          {/* Live status history (sale_events — updated by triggers in the ERP) */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
            <p className="font-bold text-navy-900 mb-4">Status History</p>
            {(!events || events.length === 0) ? (
              <p className="text-sm text-slate-500">No status changes yet — updates appear here automatically as your order progresses.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-slate-200" />
                <div className="space-y-4">
                  {(events as any[]).map((e, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-slate-200 bg-white">
                        <Clock size={13} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-navy-900">
                          {e.to_status ? (STATUS_LABEL[e.to_status] ?? e.to_status.replace("_", " ")) : "Updated"}
                          {e.from_status && <span className="font-normal text-slate-400">{" "}from {STATUS_LABEL[e.from_status] ?? e.from_status.replace("_", " ")}</span>}
                        </p>
                        {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(e.at).toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-bold text-navy-900">Items Ordered</p>
            </div>
            <div className="divide-y divide-slate-100">
              {(order.sale_lines as any[]).map((line: any) => (
                <div key={line.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
                    {line.line_type === "lens" ? "🔭" : "👓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-navy-900">{line.description}</p>
                    {line.details && <p className="text-xs text-slate-500 mt-0.5">{line.details}</p>}
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{line.line_type?.replace("_"," ")}</p>
                    <p className="text-xs text-slate-500 mt-1">Qty: {line.qty}</p>
                  </div>
                  <p className="font-semibold text-sm text-navy-900 shrink-0">{inr(line.line_total)}</p>
                </div>))}
            </div>
            {/* Price breakdown */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{inr(order.grand_total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Shipping</span><span className="text-emerald-600 font-medium">Free</span></div>
              <div className="flex justify-between font-bold text-navy-900 text-base pt-1 border-t border-slate-200">
                <span>Total</span><span>{inr(order.grand_total)}</span>
              </div>
              {balance > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>Balance due</span><span>{inr(balance)}</span>
                </div>)}
            </div>
          </div>

          {/* Payments */}
          {(order.payments as any[])?.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <p className="font-bold text-navy-900 mb-3 flex items-center gap-2"><CreditCard size={16}/>Payments</p>
              <div className="space-y-2">
                {(order.payments as any[]).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium capitalize">{(p.method||"payment").replace("_"," ")}</p>
                      {p.reference && <p className="text-xs text-slate-400">Ref: {p.reference}</p>}
                      {p.paid_at && <p className="text-xs text-slate-400">{dStr(p.paid_at)}</p>}
                    </div>
                    <span className="font-semibold text-emerald-600">{inr(p.amount)}</span>
                  </div>))}
              </div>
            </div>)}
        </div>

        {/* Right: Summary + Actions */}
        <div className="space-y-4">
          {/* Order summary */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="font-bold text-navy-900">Order Info</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-gold-500 mt-0.5 shrink-0"/>
                <div>
                  <p className="font-medium text-slate-700">Fulfilment</p>
                  <p className="text-slate-500">{order.supply_type === "delivery" ? "Home Delivery" : `Store Pickup — ${site.storeName || "Store"}`}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CreditCard size={15} className="text-gold-500 mt-0.5 shrink-0"/>
                <div>
                  <p className="font-medium text-slate-700">Payment</p>
                  <p className="text-slate-500">{order.payment_status === "paid" ? "Fully paid" : balance > 0 ? `${inr(balance)} balance due` : "Pending"}</p>
                </div>
              </div>
              {order.notes && (
                <div className="flex items-start gap-2.5">
                  <Package size={15} className="text-gold-500 mt-0.5 shrink-0"/>
                  <div>
                    <p className="font-medium text-slate-700">Notes</p>
                    <p className="text-slate-500 text-xs">{order.notes}</p>
                  </div>
                </div>)}
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="font-bold text-navy-900">Actions</p>
            <a href={waHref(site.whatsappNumber, `Query about order ${order.code}`)} target="_blank"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition">
              💬 Track / Query on WhatsApp
            </a>
            {isDelivered && (
              <Link href="/eyeglasses" className="flex items-center justify-center gap-2 rounded-xl border border-navy-800 px-4 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50 transition">
                🔄 Buy Again
              </Link>)}
            {balance > 0 && !isCancelled && (
              <a href={waHref(site.whatsappNumber, `I need to pay the balance for order ${order.code}`)} target="_blank"
                className="flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-white hover:bg-gold-600 transition">
                Pay Balance {inr(balance)}
              </a>)}
          </div>

          {/* Support */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-center">
            <p className="text-slate-500">Need help with this order?</p>
            <div className="flex justify-center gap-3 mt-2">
              <a href={`tel:${site.phones[0]}`} className="flex items-center gap-1 text-navy-700 font-semibold hover:underline"><Phone size={13}/>Call us</a>
              <a href={waHref(site.whatsappNumber)} target="_blank" className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline">💬 WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
