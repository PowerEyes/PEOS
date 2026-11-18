
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";

const inr = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

export default async function ReorderPage() {
  const sb = supabaseServer();
  const {data:{user}} = await sb.auth.getUser();
  if(!user) redirect("/my/login");
  const {data:c} = await sb.from("customers").select("id").eq("auth_user_id",user.id).maybeSingle();
  if(!c) redirect("/my/login");
  const {data:orders} = await sb.from("sales")
    .select("id,code,grand_total,created_at,status,sale_lines(description,qty,line_total)")
    .eq("customer_id",c.id).eq("kind","order").eq("status","delivered")
    .order("created_at",{ascending:false}).limit(20);

  return (
    <PortalLayout activePath="/my/reorder">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 text-white px-8 py-10 mb-6">
        <h1 className="font-extrabold text-3xl">REORDER</h1>
        <p className="text-white/80 mt-1">Repeat a previous purchase in two taps.</p>
      </div>
      {(!orders||orders.length===0)
        ? <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">🔄</div>
            <p className="font-semibold text-slate-600">No delivered orders yet</p>
            <Link href="/eyeglasses" className="mt-4 inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">Shop Eyewear</Link>
          </div>
        : <div className="space-y-4">
            {orders.map((o:any)=>{
              const lines = o.sale_lines||[];
              return (
                <div key={o.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-wrap items-center gap-4">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">👓</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-navy-900">Order #{o.code}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{new Date(o.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})} · {inr(o.grand_total)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{lines.slice(0,3).map((l:any,i:number)=><span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{l.description}</span>)}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/my/orders/${o.id}`} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50">View Details</Link>
                    <Link href="/eyeglasses" className="rounded-lg bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700">Reorder →</Link>
                  </div>
                </div>);})}
          </div>}
    </PortalLayout>
  );
}
