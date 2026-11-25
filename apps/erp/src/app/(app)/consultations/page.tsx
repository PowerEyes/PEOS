import Link from "next/link";
import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";

export default async function ConsultationsPage() {
  const sb = supabaseServer();
  const { only } = await getScopeCtx();
  const { data: exams, error } = await only(
    sb.from("eye_examinations")
      .select("id, created_at, examiner_name, rx_type, od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, customers!eye_examinations_customer_id_fkey(full_name, vision_id, customer_code)")
  ).order("created_at", { ascending: false }).limit(100);

  const examRows=exams??[]; const monthStart=new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const thisMonth=examRows.filter((e:any)=>new Date(e.created_at)>=monthStart).length;
  const uniqueExaminer=new Set(examRows.map((e:any)=>e.examiner_name).filter(Boolean)).size;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clinical consultations</h1>
          <p className="text-sm text-slate-500">Recorded eye examinations and clinical findings</p>
        </div>
        <Link href="/appointments" className="btn btn-primary">Open appointments to record an examination</Link>
      </div>
      <ModuleKpiGrid items={[{label:"Examinations loaded",value:examRows.length,detail:"Recent records within branch scope",icon:KPIIcons.check},{label:"This month",value:thisMonth,detail:"Examinations recorded since month start",tone:"info",icon:KPIIcons.trend},{label:"Examiners",value:uniqueExaminer,detail:"Distinct examiners in loaded records",icon:KPIIcons.users},{label:"Data status",value:error?"Error":"Loaded",detail:error?"Review the loading error below":"Records loaded successfully",tone:error?"danger":"success",icon:KPIIcons.warning}]} />
      {error ? <div role="alert" className="card p-5 text-sm text-rose-600">Examinations could not be loaded. {error.message}</div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Vision ID</th><th className="p-3 text-left">Examiner</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Details</th></tr></thead>
              <tbody>
                {(exams ?? []).map((exam: any) => (
                  <tr key={exam.id} className="border-t">
                    <td className="p-3 font-medium">{exam.customers?.full_name ?? "—"}</td>
                    <td className="p-3">{exam.customers?.vision_id ?? "—"}</td>
                    <td className="p-3">{exam.examiner_name ?? "—"}</td>
                    <td className="p-3">{exam.rx_type ?? "—"}</td>
                    <td className="p-3">{new Date(exam.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="p-3"><Link className="text-gold-600 hover:underline" href={`/consultations/${exam.id}`}>View examination</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!exams || exams.length === 0) && <p className="p-6 text-center text-sm text-slate-500">No examinations recorded for this branch.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
