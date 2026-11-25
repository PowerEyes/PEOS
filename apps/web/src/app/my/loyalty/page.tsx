import { PortalPageHeader } from "@/components/PortalPageHeader";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import { supabaseServer } from "@/lib/supabase/server";
import { Gift } from "lucide-react";
const TIERS=[{n:"Silver",pts:0,col:"from-slate-400 to-slate-500"},{n:"Gold",pts:500,col:"from-gold-400 to-gold-600"},{n:"Platinum",pts:1500,col:"from-blue-400 to-blue-600"},{n:"Diamond",pts:3000,col:"from-violet-400 to-violet-600"}];
export default async function Page() {
  const c = await getCustomer(); if (!c) redirect("/my/login");
  const sb = supabaseServer();
  // Balance = sum of ALL ledger entries (history list stays short).
  const [{ data: balanceRows }, { data: ledger }] = await Promise.all([
    sb.from("loyalty_ledger").select("delta").eq("customer_id",c.id).limit(1000),
    sb.from("loyalty_ledger").select("delta,reason,created_at").eq("customer_id",c.id).order("created_at",{ascending:false}).limit(20),
  ]);
  const points = (balanceRows??[]).reduce((a,r)=>a+Number(r.delta),0);
  const tier = TIERS.slice().reverse().find(t=>points>=t.pts)||TIERS[0];
  const next = TIERS[TIERS.indexOf(tier)+1];
  return (
    <div className="space-y-5">
      <PortalPageHeader title="Loyalty & Rewards" description="View your points balance, membership tier, and recent rewards activity."/>
      <div className={`card bg-gradient-to-br ${tier.col} p-6 text-white`}>
        <div className="flex items-center justify-between"><div><p className="text-sm text-white/70">Your Points</p><p className="font-display text-5xl font-bold mt-1">{points}</p><p className="mt-1 font-semibold">{tier.n} Member</p></div>
          <Gift size={48} className="text-white/30"/></div>
        {next&&<div className="mt-4 space-y-1"><p className="text-xs text-white/70">{next.pts-points} points to {next.n}</p><div className="h-2 rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{width:`${Math.min(100,((points-tier.pts)/(next.pts-tier.pts))*100)}%`}}/></div></div>}
      </div>
      <div className="card p-5"><p className="font-semibold mb-3">How to earn points</p>
        <div className="grid grid-cols-2 gap-3 text-sm">{[["Buying eyeglasses","10 pts / ₹100"],["Eye test booking","50 pts"],["Refer a friend","200 pts"],["Write a review","25 pts"]].map(([l,v])=><div key={l} className="rounded-xl bg-gold-50 p-3"><p className="font-medium text-gold-700">{v}</p><p className="text-xs text-slate-500 mt-0.5">{l}</p></div>)}</div></div>
      {(ledger??[]).length>0&&<div className="card p-5"><p className="font-semibold mb-3">Points history</p>
        <div className="space-y-2">{(ledger??[]).map((l,i)=><div key={i} className="flex justify-between text-sm"><span className="text-slate-600 capitalize">{l.reason.replace("_"," ")}</span><span className={`font-semibold ${Number(l.delta)>0?"text-emerald-600":"text-rose-600"}`}>{Number(l.delta)>0?"+":""}{l.delta}</span></div>)}</div></div>}
    </div>);
}
