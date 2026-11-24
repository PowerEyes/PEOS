import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: consultation } = await sb.from("consultations").select("*").eq("id", params.id).single();
  if (!consultation) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Consultation Details</h1>
      <div className="card p-6">
        <p className="text-sm text-slate-500">Customer: {consultation.customer_name}</p>
        <p className="text-sm text-slate-500">Status: {consultation.status}</p>
        <p className="text-sm text-slate-500">Date: {new Date(consultation.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}