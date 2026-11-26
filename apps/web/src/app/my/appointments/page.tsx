import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/customer";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
const S:any={scheduled:"bg-amber-50 text-amber-700",confirmed:"bg-blue-50 text-blue-700",arrived:"bg-emerald-50 text-emerald-700",completed:"bg-emerald-50 text-emerald-700",cancelled:"bg-rose-50 text-rose-600",no_show:"bg-slate-50 text-slate-500"};
export default async function Page() {
  const c = await getCustomer(); if (!c) redirect("/my/login");
  const { data } = await supabaseServer().from("appointments").select("*").eq("customer_id",c.id).order("appt_date",{ascending:false}).limit(20);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-bold text-navy-900">Eye Test Appointments</h1><Link href="/eye-test" className="btn-gold text-sm">Book New</Link></div>
      {!data?.length ? <div className="card p-16 text-center"><CalendarDays size={40} className="mx-auto mb-3 text-slate-300"/><p className="font-semibold text-slate-600">No appointments yet</p><Link href="/eye-test" className="btn-gold mt-5 inline-flex">Book an Eye Test</Link></div>
        : <div className="space-y-3">{data.map(a=><div key={a.id} className="card p-4 flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-navy-50 flex flex-col items-center justify-center"><p className="text-lg font-bold text-navy-900">{new Date(a.appt_date+"T00:00:00").getDate()}</p><p className="text-[10px] text-slate-500">{new Date(a.appt_date+"T00:00:00").toLocaleDateString("en-IN",{month:"short"})}</p></div>
          <div className="flex-1 min-w-0"><p className="font-semibold">{a.appt_type}</p><p className="text-xs text-slate-500">{a.appt_time?.slice(0,5)} · {a.duration_mins} min{a.optometrist?` · ${a.optometrist}`:""}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${S[a.status]}`}>{a.status}</span>
        </div>)}</div>}
    </div>);
}
