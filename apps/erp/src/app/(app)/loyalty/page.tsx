import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { LoyaltyRules } from "./rules";

export const dynamic = "force-dynamic";
export default async function LoyaltyPage() {
  const sb = supabaseServer();
  const [{ data: rules }, { data: bal }, { data: me }] = await Promise.all([
    sb.from("loyalty_rules").select("earn_rate,redeem_rate,min_redeem,max_redeem_pct").maybeSingle(),
    sb.from("customer_loyalty_balance").select("customer_id,points").order("points", { ascending: false }).limit(25),
    sb.rpc("is_manager")]);
  const ids = (bal ?? []).map((b: any) => b.customer_id);
  const { data: cs } = ids.length ? await sb.from("customers").select("id,full_name,vision_id,phone").in("id", ids) : { data: [] as any[] };
  const { data: recent } = await sb.from("loyalty_ledger").select("id,customer_id,delta,reason,created_at").order("created_at", { ascending: false }).limit(10);
  const nm = (id: string) => cs?.find((c: any) => c.id === id);
  return (<div className="mx-auto max-w-4xl space-y-4">
    <div><h1 className="font-display text-2xl font-semibold">Loyalty & referrals</h1><p className="text-sm text-slate-500">Points customers earn on purchases and referrals, and how they can be redeemed.</p></div>
    <LoyaltyRules initial={{ earn_rate: Number(rules?.earn_rate ?? 0), redeem_rate: Number(rules?.redeem_rate ?? 0), min_redeem: Number(rules?.min_redeem ?? 0), max_redeem_pct: Number(rules?.max_redeem_pct ?? 0) }} canEdit={!!me} />
    <div className="card overflow-x-auto"><h2 className="p-3 pb-0 text-sm font-semibold">Top balances</h2><table className="w-full text-sm"><tbody>{(bal ?? []).map((b: any) => (<tr key={b.customer_id} className="border-t"><td className="p-3"><Link href={`/customers?open=${b.customer_id}`} className="font-medium hover:underline">{nm(b.customer_id)?.full_name ?? "Customer"}</Link><span className="ml-2 text-xs text-slate-400">{nm(b.customer_id)?.vision_id}</span></td><td className="p-3 text-right font-semibold">{b.points}</td></tr>))}
      {!(bal ?? []).length && <tr><td className="p-6 text-center text-slate-400">No points issued yet.</td></tr>}</tbody></table></div>
    <div className="card p-3"><h2 className="mb-1 text-sm font-semibold">Recent activity</h2><ul className="divide-y text-sm">{(recent ?? []).map((r: any) => <li key={r.id} className="flex justify-between py-1.5"><span>{nm(r.customer_id)?.full_name ?? "Customer"} · <span className="text-slate-500">{r.reason}</span></span><b className={r.delta < 0 ? "text-rose-600" : "text-emerald-700"}>{r.delta > 0 ? "+" : ""}{r.delta}</b></li>)}{!(recent ?? []).length && <li className="py-3 text-center text-slate-400">Nothing yet.</li>}</ul></div>
  </div>);
}
