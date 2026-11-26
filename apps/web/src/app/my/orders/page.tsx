import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import Link from "next/link";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { inr } from "@/lib/types";
import { LiveRefresh } from "@/components/LiveRefresh";
const STATUS_LABEL: Record<string,string> = { lab_pending:"In Production",in_workshop:"In Workshop",qc:"Quality Check",ready:"Ready for Pickup",delivered:"Delivered",cancelled:"Cancelled",draft:"Processing" };
const STATUS_COLOR: Record<string,string> = { lab_pending:"bg-blue-50 text-blue-700",in_workshop:"bg-violet-50 text-violet-700",qc:"bg-orange-50 text-orange-700",ready:"bg-emerald-50 text-emerald-700",delivered:"bg-emerald-50 text-emerald-700",cancelled:"bg-rose-50 text-rose-600",draft:"bg-slate-50 text-slate-600" };
export default async function OrdersPage() {
  const customer = await getCustomer(); if (!customer) redirect("/my/login");
  const { data: orders } = await supabaseServer().from("sales").select("id,code,status,payment_status,grand_total,paid_total,needs_lab,created_at,sale_lines(description,qty,line_total)").eq("customer_id", customer.id).eq("kind","order").order("created_at",{ascending:false}).limit(50);
  return (
    <div className="space-y-5">
      <LiveRefresh seconds={30} />
      <h1 className="font-display text-2xl font-bold text-navy-900">My Orders</h1>
      {!orders?.length ? (
        <div className="card p-16 text-center"><ShoppingBag size={40} className="mx-auto mb-3 text-slate-300"/><p className="font-semibold text-slate-600">No orders yet</p><Link href="/eyeglasses" className="btn-gold mt-5 inline-flex">Shop Eyeglasses</Link></div>
      ) : (
        <div className="space-y-3">{orders.map(o => {
          const bal = Number(o.grand_total) - Number(o.paid_total); const st = o.status ?? "draft";
          return (<Link key={o.id} href={`/my/orders/${o.id}`} className="block card p-5 transition hover:border-navy-200 hover:shadow-md">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div><p className="font-bold text-navy-900">{o.code}</p><p className="text-xs text-slate-400 mt-0.5">{new Date(o.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p></div>
              <div className="flex items-center gap-2">
                {bal > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Balance {inr(bal)}</span>}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st] ?? st}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">{((o.sale_lines as any[])||[]).map((l:any,i:number) => <p key={i} className="text-sm text-slate-600">{l.qty}× {l.description} — {inr(l.line_total)}</p>)}</div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="font-bold text-navy-900">{inr(o.grand_total)}</p>
              <span className="flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700">View timeline <ChevronRight size={12}/></span>
            </div>
          </Link>);})}
        </div>)}
    </div>);
}
