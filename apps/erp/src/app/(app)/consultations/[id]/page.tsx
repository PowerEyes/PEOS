import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: exam, error } = await sb.from("eye_examinations")
    .select("*, customers!eye_examinations_customer_id_fkey(full_name, phone, vision_id, customer_code)")
    .eq("id", params.id).maybeSingle();
  if (error || !exam) notFound();

  const c = exam.customers as any;
  const fields: [string, string | number | null][] = [
    ["OD sphere", exam.od_sph], ["OD cylinder", exam.od_cyl], ["OD axis", exam.od_axis],
    ["OD ADD", exam.od_add], ["OD visual acuity", exam.od_va],
    ["OS sphere", exam.os_sph], ["OS cylinder", exam.os_cyl], ["OS axis", exam.os_axis],
    ["OS ADD", exam.os_add], ["OS visual acuity", exam.os_va],
    ["Far PD", exam.pd_far], ["Near PD", exam.pd_near],
    ["Unaided OD distance VA", exam.va_od_dist_ua], ["Unaided OS distance VA", exam.va_os_dist_ua],
    ["Unaided OD near VA", exam.va_od_near_ua], ["Unaided OS near VA", exam.va_os_near_ua],
    ["IOP OD", exam.iop_od], ["IOP OS", exam.iop_os],
    ["Recommendation", exam.lens_recommendation], ["Clinical notes", exam.notes],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Eye examination</h1>
          <p className="text-sm text-slate-500">{c?.full_name ?? "Customer"} · {c?.vision_id ?? "No Vision ID"} · {new Date(exam.created_at).toLocaleString("en-IN")}</p>
        </div>
        <Link href="/consultations" className="btn btn-ghost">Back to consultations</Link>
      </div>
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        {fields.map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value == null || value === "" ? "—" : String(value)}</p></div>)}
      </div>
      <div className="flex gap-3"><Link href="/prescriptions" className="btn btn-primary">Open prescriptions</Link><Link href="/appointments" className="btn btn-ghost">Appointments</Link></div>
    </div>
  );
}
