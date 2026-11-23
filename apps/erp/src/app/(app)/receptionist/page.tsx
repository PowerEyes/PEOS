import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ReceptionistPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("branch_id").eq("user_id", user.id).single();
  const { data: appointments } = await sb.from("appointments").select("id, customer_name, time, status").eq("branch_id", profile?.branch_id).order("time");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Reception Dashboard</h1>
        <Link href="/appointments?new=1" className="btn btn-primary">New Appointment</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Today's Appointments</p><p className="text-3xl font-bold text-navy-900">{appointments?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Checked In</p><p className="text-3xl font-bold text-green-600">0</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Walk-ins</p><p className="text-3xl font-bold text-blue-600">0</p></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-navy-900 mb-3">Appointment Calendar</h3>
        {appointments?.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div><p className="font-medium">{a.customer_name}</p><p className="text-sm text-slate-500">{a.time} · {a.status}</p></div>
            <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">{a.status}</span>
          </div>
        ))}
        {(!appointments || appointments.length === 0) && <p className="text-sm text-slate-500">No appointments today</p>}
      </div>
    </div>
  );
}