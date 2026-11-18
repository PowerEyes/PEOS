
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const dStr = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone:"Asia/Kolkata" }) : "—";
const tStr = (d: string) => d ? new Date(d).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Kolkata" }) : "";

const METHOD_ICON: Record<string, string> = {
  upi:"📲", card:"💳", net_banking:"🏦", cash:"💵",
  razorpay:"💳", online:"💳", cod:"📦",
};
const STATUS_UI: Record<string, { label:string; cls:string; icon:any }> = {
  paid:    { label:"Paid",    cls:"bg-emerald-50 text-emerald-700 border-emerald-100", icon:CheckCircle },
  success: { label:"Paid",    cls:"bg-emerald-50 text-emerald-700 border-emerald-100", icon:CheckCircle },
  failed:  { label:"Failed",  cls:"bg-rose-50 text-rose-600 border-rose-100",         icon:XCircle },
  pending: { label:"Pending", cls:"bg-amber-50 text-amber-700 border-amber-100",      icon:Clock },
  refunded:{ label:"Refunded",cls:"bg-blue-50 text-blue-700 border-blue-100",         icon:CheckCircle },
};

export default async function PaymentsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");
  const { data: c } = await sb.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!c) redirect("/my/login");

  // Online payments via Razorpay
  const { data: online } = await sb.from("online_payments")
    .select("id,amount,status,razorpay_payment_id,razorpay_order_id,created_at,sale_id")
    .eq("customer_id", c.id).order("created_at", { ascending: false }).limit(30);

  // In-store payments from payments table
  const { data: inStore } = await sb.from("payments")
    .select("id,amount,method,reference,created_at,sale_id,sales(code)")
    .eq("sales.customer_id", c.id).order("created_at", { ascending: false }).limit(30);

  const totalSpent = [...(online ?? []).filter(p => ["paid","success"].includes(p.status)).map(p => Number(p.amount)),
                      ...(inStore ?? []).map(p => Number(p.amount))].reduce((a, b) => a + b, 0);

  return (
    <PortalLayout activePath="/my/payments">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white px-7 py-9 mb-6">
        <h1 className="font-extrabold text-3xl flex items-center gap-3"><CreditCard size={28}/>PAYMENTS</h1>
        <p className="text-slate-300 mt-1">Your complete payment history — online and in-store.</p>
        <div className="mt-4 flex flex-wrap gap-5">
          <div><p className="text-xs text-slate-400">Total Spent</p><p className="font-extrabold text-2xl text-gold-400">{inr(totalSpent)}</p></div>
          <div><p className="text-xs text-slate-400">Transactions</p><p className="font-extrabold text-2xl">{(online?.length ?? 0) + (inStore?.length ?? 0)}</p></div>
        </div>
      </div>

      {/* Online payments */}
      {(online ?? []).length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
            <span className="text-lg">💳</span>
            <p className="font-bold text-navy-900">Online Payments (Razorpay)</p>
          </div>
          <div className="divide-y divide-slate-100">
            {(online ?? []).map(p => {
              const st = STATUS_UI[p.status ?? "pending"] ?? STATUS_UI.pending;
              const StIcon = st.icon;
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${st.cls}`}>
                    <StIcon size={16}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-navy-900">{inr(p.amount)}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {dStr(p.created_at)} {tStr(p.created_at)}
                      {p.razorpay_payment_id && <span className="ml-2 font-mono">ID: {p.razorpay_payment_id.slice(0,16)}…</span>}
                    </p>
                  </div>
                  {p.sale_id && (
                    <Link href={`/my/orders/${p.sale_id}`} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition">
                      View Order
                    </Link>)}
                </div>);})}
          </div>
        </div>)}

      {/* In-store payments */}
      {(inStore ?? []).length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden mb-5">
          <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
            <span className="text-lg">🏪</span>
            <p className="font-bold text-navy-900">In-Store Payments</p>
          </div>
          <div className="divide-y divide-slate-100">
            {(inStore ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="text-2xl shrink-0">{METHOD_ICON[p.method] ?? "💵"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{inr(p.amount)}</p>
                    <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 capitalize">{p.method?.replace("_"," ")}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {dStr(p.created_at)}
                    {p.sales?.code && <span className="ml-2">Order #{p.sales.code}</span>}
                    {p.reference && <span className="ml-2 font-mono">Ref: {p.reference}</span>}
                  </p>
                </div>
              </div>))}</div>
        </div>)}

      {(online ?? []).length === 0 && (inStore ?? []).length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-slate-200"/>
          <p className="font-semibold text-slate-600">No payment history yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Your payment records will appear here after your first purchase.</p>
          <Link href="/eyeglasses" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">Shop Eyewear</Link>
        </div>)}

      {/* Security note */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 flex items-start gap-2 mt-4">
        <span className="text-lg shrink-0">🔒</span>
        <div>
          <p className="font-semibold text-slate-600">Secure Payments</p>
          <p className="mt-0.5">All online payments are processed by Razorpay (PCI-DSS Level 1). We never store your card or UPI details. For payment disputes, contact us on 9840496404.</p>
        </div>
      </div>
    </PortalLayout>);
}
