import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ConsultationsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id").eq("user_id", user.id).single();
  const { data: consultations } = await sb.from("consultations").select("id, customer_name, status, created_at").eq("tenant_id", profile?.tenant_id).order("created_at", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Consultations</h1>
          <p className="text-sm text-slate-500">Complete optometry consultation records</p>
        </div>
        <Link href="/consultations/new" className="btn btn-primary">+ New Consultation</Link>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Customer</th><th className="text-left p-3">Status</th><th className="text-left p-3">Date</th><th className="text-left p-3">Actions</th></tr></thead>
          <tbody>
            {consultations?.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.customer_name}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">{c.status}</span></td>
                <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="p-3"><Link href={`/consultations/${c.id}`} className="text-gold-600 hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!consultations || consultations.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No consultations yet</p>}
      </div>
    </div>
  );
}