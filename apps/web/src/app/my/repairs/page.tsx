
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PortalLayout } from "@/components/PortalLayout";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";

const STATUS_LABEL: Record<string,string> = {pending:"Pending",in_progress:"In Progress",ready:"Ready",delivered:"Delivered",cancelled:"Cancelled"};
const STATUS_COLOR: Record<string,string> = {pending:"bg-amber-100 text-amber-700",in_progress:"bg-blue-100 text-blue-700",ready:"bg-emerald-100 text-emerald-700",delivered:"bg-slate-100 text-slate-600",cancelled:"bg-rose-100 text-rose-600"};

export default async function RepairsPage() {
  const site = await getSiteSettings();
  const sb = supabaseServer();
  const {data:{user}} = await sb.auth.getUser();
  if(!user) redirect("/my/login");
  const {data:c} = await sb.from("customers").select("id").eq("auth_user_id",user.id).maybeSingle();
  if(!c) redirect("/my/login");
  const {data:repairs} = await sb.from("repairs")
    .select("id,code,problem,item_type,status,priority,total_amount,paid,due_date,created_at,item_brand,item_model,branches(name)")
    .eq("customer_id",c.id).order("created_at",{ascending:false}).limit(30);

  return (
    <PortalLayout activePath="/my/repairs">
      <LiveRefresh seconds={30} />
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 to-navy-800 text-white px-8 py-10 mb-6">
        <h1 className="font-extrabold text-3xl">REPAIRS & SERVICE</h1>
        <p className="text-slate-300 mt-1">Track your eyewear repairs and service requests.</p>
        <div className="absolute right-8 top-5 text-5xl opacity-20">🔧</div>
      </div>

      {/* Submit new repair CTA */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-bold text-navy-900">Need a repair or service?</p>
            <p className="text-sm text-slate-500 mt-0.5">Register a repair online in under a minute — you'll get a ticket number instantly.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/my/repairs/new" className="rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition">+ Register Repair</Link>
            <a href={waHref(site.whatsappNumber, "I need a repair service for my eyewear")} target="_blank" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition">💬 WhatsApp Us</a>
          </div>
        </div>
      </div>

      {/* Service types */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[["🔩","Frame Repair","Broken or bent frames"],["🔧","Lens Replacement","Scratched or broken lenses"],["⚙️","Adjustment","Frame fit & comfort"],["✨","Cleaning","Professional lens cleaning"]].map(([e,t,s])=>(
          <div key={t as string} className="rounded-xl bg-white border border-slate-100 p-4 text-center">
            <span className="text-2xl">{e}</span>
            <p className="text-sm font-semibold text-navy-900 mt-2">{t}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s}</p>
          </div>))}
      </div>

      <h2 className="font-bold text-xl text-navy-900 mb-4">My Repair Tickets</h2>
      {(!repairs||repairs.length===0)
        ? <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">🔧</div>
            <p className="font-semibold text-slate-600">No repair tickets yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Register a repair online or contact us on WhatsApp to log one</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/my/repairs/new" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition">+ Register Repair</Link>
              <a href={waHref(site.whatsappNumber, "I need a repair service")} target="_blank" className="inline-flex rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white">💬 Contact on WhatsApp</a>
            </div>
          </div>
        : <div className="space-y-4">
            {(repairs||[]).map((r:any)=>{
              const s=r.status||"pending";
              return (
                <Link key={r.id} href={`/my/repairs/${r.id}`} className="block rounded-2xl bg-white border border-slate-100 shadow-sm p-5 transition hover:border-navy-200 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-navy-900">#{r.code||r.id.slice(0,8).toUpperCase()}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[s]||"bg-slate-100 text-slate-500"}`}>{STATUS_LABEL[s]||s}</span>
                        {r.priority==="urgent"&&<span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">Urgent</span>}
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{r.problem||"General repair"}{r.item_brand?` · ${r.item_brand} ${r.item_model||""}`:""}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                        <span>Logged: {new Date(r.created_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</span>
                        {r.due_date&&<span>Due: {new Date(r.due_date).toLocaleDateString("en-IN",{dateStyle:"medium"})}</span>}
                        {(r.branches as any)?.name&&<span>Store: {(r.branches as any).name}</span>}
                      </div>
                      {Number(r.total_amount||0)>0&&<div className="mt-2 flex gap-4 text-xs"><span>Est. cost: <b>₹{Number(r.total_amount).toLocaleString("en-IN")}</b></span>{r.paid&&<span className="text-emerald-600 font-medium">Paid in full</span>}{!r.paid&&s!=="cancelled"&&<span className="text-amber-600 font-medium">Balance: ₹{Number(r.total_amount).toLocaleString("en-IN")}</span>}</div>}
                    </div>
                    <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-700 shrink-0">View details →</span>
                  </div>
                  {/* Status stepper */}
                  <div className="mt-4 flex items-center gap-0 pt-4 border-t border-slate-100">
                    {["Received","In Progress","Ready","Delivered"].map((step,i)=>{
                      const stepKeys=["pending","in_progress","ready","delivered"];
                      const curr=stepKeys.indexOf(s); const done=i<=curr;
                      return (
                        <div key={step} className="flex flex-1 items-center">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done?"bg-navy-800 text-white":"bg-slate-200 text-slate-400"}`}>{done?"✓":i+1}</div>
                            <p className={`text-[10px] mt-1 text-center ${done?"text-navy-800 font-medium":"text-slate-400"}`}>{step}</p>
                          </div>
                          {i<3&&<div className={`h-px flex-1 mx-1 ${done&&i<curr?"bg-navy-800":"bg-slate-200"}`}/>}
                        </div>);})}
                  </div>
                </Link>);})}
          </div>}
    </PortalLayout>
  );
}
