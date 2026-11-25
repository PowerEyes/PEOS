import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { ModuleKpiGrid, KPIIcons } from "@/components/ModuleKpiGrid";

export default async function SuppliersPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await sb
    .from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.org_id) {
    return <div className="card p-6 text-sm text-rose-600">Your organization context could not be verified. Contact your administrator.</div>;
  }

  const { data: suppliers, error } = await sb
    .from("suppliers")
    .select("id, name, contact_person, phone, email, status")
    .eq("org_id", profile.org_id)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Suppliers</h1>
          <p className="text-sm text-slate-500">Supplier directory and management</p>
        </div>
        <Link href="/purchases" className="btn btn-primary">Manage purchases</Link>
      </div>
      {!error && <ModuleKpiGrid items={[{label:"Suppliers",value:suppliers?.length ?? 0,detail:"Suppliers in this organization",icon:KPIIcons.users},{label:"Active",value:(suppliers ?? []).filter((s:any)=>s.status==="active").length,detail:"Available for purchasing",tone:"success",icon:KPIIcons.check},{label:"Inactive",value:(suppliers ?? []).filter((s:any)=>s.status!=="active").length,detail:"Not currently active",tone:"warning",icon:KPIIcons.warning},{label:"Contact coverage",value:(suppliers ?? []).filter((s:any)=>s.phone||s.email).length,detail:"Have at least one contact method",icon:KPIIcons.trend}]} />}
      {error ? <div role="alert" className="card p-5 text-sm text-rose-600">Suppliers could not be loaded. {error.message}</div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Contact</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Email</th><th className="text-left p-3">Status</th></tr></thead>
              <tbody>
                {(suppliers ?? []).map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-medium"><Link href={`/suppliers/${s.id}`} className="text-gold-600 hover:underline">{s.name}</Link></td>
                    <td className="p-3">{s.contact_person || "—"}</td>
                    <td className="p-3">{s.phone || "—"}</td>
                    <td className="p-3">{s.email || "—"}</td>
                    <td className="p-3">{s.status || "active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!suppliers || suppliers.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No suppliers found for this organization.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
