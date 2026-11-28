import { requirePlatform } from "@/lib/platform-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LeadRow } from "./lead-row";
export const dynamic = "force-dynamic";
export default async function Leads({ searchParams }: { searchParams: { s?: string } }) {
  await requirePlatform();
  const s = ["new", "contacted", "converted", "rejected"].includes(searchParams.s ?? "") ? searchParams.s! : "new";
  const { data } = await supabaseAdmin().from("saas_leads").select("*").eq("status", s).order("created_at", { ascending: false }).limit(200);
  return (<div className="space-y-4"><div><h1 className="text-xl font-semibold">Leads</h1><p className="text-sm text-slate-400">Businesses that asked for PowerOS from the website. Convert a lead by registering the company under Companies, then mark it converted.</p></div>
    <div className="flex gap-2 text-sm">{["new", "contacted", "converted", "rejected"].map(x => <a key={x} href={`?s=${x}`} className={`rounded-full border px-3 py-1 capitalize ${x === s ? "border-gold-500 bg-gold-500 text-slate-950" : "border-slate-700"}`}>{x}</a>)}</div>
    {(data ?? []).length === 0 ? <p className="text-sm text-slate-400">No {s} leads.</p> : <ul className="space-y-3">{(data ?? []).map((l: any) => <LeadRow key={l.id} lead={l} />)}</ul>}</div>);
}
