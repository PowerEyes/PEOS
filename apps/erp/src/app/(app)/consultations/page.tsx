import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getScopeCtx } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";
const f = (v: any) => (v === null || v === undefined || v === "" ? "–" : String(v));
export default async function Consultations({ searchParams }: { searchParams: { q?: string } }) {
  const sb = supabaseServer(), { only } = await getScopeCtx(), q = (searchParams.q ?? "").trim().replace(/[%,()*\\]/g, " ");
  const base = only(sb.from("eye_examinations").select("id,customer_id,examiner_name,created_at,od_sph,od_cyl,od_axis,od_add,os_sph,os_cyl,os_axis,os_add,customers!inner(full_name,vision_id,phone)").order("created_at", { ascending: false }).limit(100));
  const { data } = await (q ? base.or(`full_name.ilike.%${q}%,vision_id.ilike.%${q}%,phone.ilike.%${q}%`, { foreignTable: "customers" }) : base);
  return (<div className="mx-auto max-w-6xl space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold">Consultations</h1><p className="text-sm text-slate-500">Eye examination records. A new examination is recorded from the customer&apos;s appointment.</p></div>
      <Link href="/appointments" className="btn btn-primary text-sm">Start from appointments</Link></div>
    <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search customer name, vision ID or phone" className="field w-full max-w-sm text-sm" /><button className="btn btn-ghost text-sm">Search</button></form>
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Date</th><th>Customer</th><th>Examiner</th><th>Right (SPH / CYL / AXIS / ADD)</th><th>Left (SPH / CYL / AXIS / ADD)</th><th /></tr></thead>
      <tbody>{(data ?? []).map((e: any) => (<tr key={e.id} className="border-t"><td className="whitespace-nowrap p-3">{new Date(e.created_at).toLocaleDateString("en-IN")}</td>
        <td><Link href={`/customers?open=${e.customer_id}`} className="font-medium underline-offset-2 hover:underline">{e.customers?.full_name}</Link><span className="block text-xs text-slate-400">{e.customers?.vision_id}</span></td><td>{f(e.examiner_name)}</td>
        <td className="whitespace-nowrap">{[e.od_sph, e.od_cyl, e.od_axis, e.od_add].map(f).join(" / ")}</td><td className="whitespace-nowrap">{[e.os_sph, e.os_cyl, e.os_axis, e.os_add].map(f).join(" / ")}</td><td className="pr-3"><Link href={`/consultations/${e.id}`} className="text-xs underline">View</Link></td></tr>))}
        {!(data ?? []).length && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No examinations found.</td></tr>}</tbody></table></div>
  </div>);
}
