import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SuppliersPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: suppliers } = await sb.from("suppliers").select("*").eq("tenant_id", profile?.tenant_id).order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Suppliers</h1>
        <p className="text-sm text-slate-500">Supplier directory and management</p>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Contact</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Email</th></tr></thead>
          <tbody>
            {suppliers?.map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-medium"><Link href={`/suppliers/${s.id}`} className="text-gold-600 hover:underline">{s.name}</Link></td>
                <td className="p-3">{s.contact_person || "—"}</td>
                <td className="p-3">{s.phone || "—"}</td>
                <td className="p-3">{s.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!suppliers || suppliers.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No suppliers yet</p>}
      </div>
    </div>
  );
}