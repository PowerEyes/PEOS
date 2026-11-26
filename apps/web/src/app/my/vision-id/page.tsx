import { getStoreName } from "@/lib/site";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import { Eye, Users, CalendarDays, FileText } from "lucide-react";
export default async function Page() {
  const storeName = await getStoreName();
  const c = await getCustomer(); if (!c) redirect("/my/login");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-navy-900">My Vision ID</h1>
      <div className="card bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-white">
        <div className="flex items-start justify-between"><div><p className="text-gold-400 text-sm font-semibold">Vision ID</p><p className="font-display text-3xl font-bold mt-1">{c.vision_id}</p><p className="text-slate-300 text-sm mt-1">{c.full_name}</p><p className="text-slate-400 text-xs mt-0.5">Customer ID: {c.customer_code}</p></div><Eye size={40} className="text-white/20"/></div>
        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400">Your permanent Vision ID links your entire optical health history with {storeName}.</div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[Eye,"Vision ID","Your permanent optical ID"],[FileText,"Prescriptions","All your Rx on record"],[CalendarDays,"Appointments","Eye test history"],[Users,"Family","Manage family members"]].map(([I,l,d]:any)=>(
          <div key={l} className="card p-4 text-center"><I size={24} className="mx-auto text-gold-500 mb-2"/><p className="text-sm font-semibold">{l}</p><p className="text-xs text-slate-400 mt-0.5">{d}</p></div>))}
      </div>
      <div className="card p-5"><p className="font-semibold mb-1">About your Vision ID</p><p className="text-sm text-slate-600">Your Vision ID (<b>{c.vision_id}</b>) is a permanent, unique identifier that stays with you forever. It lets you access your complete eye care history, prescriptions and orders at any {storeName} store or online.</p></div>
    </div>);
}
