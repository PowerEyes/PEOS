import { supabaseServer } from "@/lib/supabase/server";

export default async function CompanySupportPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: company } = await sb.from("tenants").select("name").eq("id", params.id).single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{company?.name} — Support History</h1>
      <div className="card p-6 text-center text-slate-500">
        <p>No support tickets yet</p>
        <p className="text-sm mt-1">Support tickets will appear here when created</p>
      </div>
    </div>
  );
}