import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OptometristPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id").eq("user_id", user.id).single();
  const { data: appointments } = await sb.from("appointments").select("id, customer_name, time, status").eq("branch_id", profile?.branch_id).eq("status", "scheduled").order("time");
  const { data: prescriptions } = await sb.from("prescriptions").select("id, customer_name, created_at").eq("tenant_id", profile?.tenant_id).order("created_at", { ascending: false }).limit(10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Optometrist Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Today's Appointments</p><p className="text-3xl font-bold text-navy-900">{appointments?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Recent Prescriptions</p><p className="text-3xl font-bold text-navy-900">{prescriptions?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Pending Exams</p><p className="text-3xl font-bold text-navy-900">0</p></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Today's Appointment Queue</h3>
        {appointments?.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div><p className="font-medium">{a.customer_name}</p><p className="text-sm text-slate-500">{a.time}</p></div>
            <Link href={`/appointments/${a.id}`} className="btn btn-outline text-sm">Start Exam</Link>
          </div>
        ))}
        {(!appointments || appointments.length === 0) && <p className="text-sm text-slate-500">No appointments scheduled</p>}
      </div>
    </div>
  );
}