import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const v = (x: any) => (x === null || x === undefined || x === "" ? "–" : String(x));
const GROUPS: { title: string; rows: [string, string, string][] }[] = [
  { title: "Visual acuity", rows: [["Distance, unaided", "va_od_dist_ua", "va_os_dist_ua"], ["Near, unaided", "va_od_near_ua", "va_os_near_ua"], ["Distance, aided", "va_od_dist_a", "va_os_dist_a"], ["Near, aided", "va_od_near_a", "va_os_near_a"]] },
  { title: "Auto-refraction", rows: [["Sphere", "ar_od_sph", "ar_os_sph"], ["Cylinder", "ar_od_cyl", "ar_os_cyl"], ["Axis", "ar_od_axis", "ar_os_axis"]] },
  { title: "Final prescription", rows: [["Sphere", "od_sph", "os_sph"], ["Cylinder", "od_cyl", "os_cyl"], ["Axis", "od_axis", "os_axis"], ["Add", "od_add", "os_add"], ["Visual acuity", "od_va", "os_va"]] },
  { title: "Eye health", rows: [["IOP", "iop_od", "iop_os"], ["Anterior segment", "anterior_od", "anterior_os"], ["Fundus", "fundus_od", "fundus_os"], ["Disc", "disc_od", "disc_os"], ["Cup/disc", "cup_disc_od", "cup_disc_os"], ["Macula", "macula_od", "macula_os"], ["Vessels", "vessels_od", "vessels_os"]] },
];
export default async function ConsultationDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: e } = await sb.from("eye_examinations").select("*, customers(full_name,vision_id,phone)").eq("id", params.id).maybeSingle();
  if (!e) notFound();
  return (<div className="mx-auto max-w-4xl space-y-4">
    <div><Link href="/consultations" className="text-xs text-slate-500 hover:underline">← Consultations</Link>
      <h1 className="font-display text-2xl font-semibold">Consultation — {e.customers?.full_name}</h1>
      <p className="text-sm text-slate-500">{new Date(e.created_at).toLocaleString("en-IN")} · Examiner: {v(e.examiner_name)} · <Link href={`/customers?open=${e.customer_id}`} className="underline">Open customer</Link></p></div>
    {GROUPS.map((g) => (<div key={g.title} className="card overflow-x-auto"><h2 className="p-3 pb-0 text-sm font-semibold">{g.title}</h2><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="p-3">Measure</th><th>Right eye</th><th>Left eye</th></tr></thead>
      <tbody>{g.rows.map(([l, a, b]) => <tr key={a} className="border-t"><td className="p-3">{l}</td><td>{v(e[a])}</td><td>{v(e[b])}</td></tr>)}</tbody></table></div>))}
    <div className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
      <p><b>PD (far / near):</b> {v(e.pd_far)} / {v(e.pd_near)}</p><p><b>Cover test:</b> {v(e.cover_test)}</p><p><b>Colour vision:</b> {v(e.colour_vision)}</p><p><b>Next review:</b> {e.next_review_months ? `${e.next_review_months} months` : "–"}</p>
      <p><b>Lens recommendation:</b> {v(e.lens_recommendation)}</p><p><b>Recommended index:</b> {v(e.recommended_index)}</p><p className="sm:col-span-2"><b>Notes:</b> {v(e.notes)}</p></div>
  </div>);
}
