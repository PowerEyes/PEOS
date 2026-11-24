import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: supplier } = await sb.from("suppliers").select("*").eq("id", params.id).single();
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">{supplier.name}</h1>
      <div className="card p-6 space-y-3">
        <p className="text-sm"><span className="font-medium">Contact:</span> {supplier.contact_person || "—"}</p>
        <p className="text-sm"><span className="font-medium">Phone:</span> {supplier.phone || "—"}</p>
        <p className="text-sm"><span className="font-medium">Email:</span> {supplier.email || "—"}</p>
        <p className="text-sm"><span className="font-medium">Address:</span> {supplier.address || "—"}</p>
        <p className="text-sm"><span className="font-medium">GSTIN:</span> {supplier.gstin || "—"}</p>
      </div>
    </div>
  );
}