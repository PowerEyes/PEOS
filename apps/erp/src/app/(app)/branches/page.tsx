import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { ModuleKpiGrid } from "@/components/ModuleKpiGrid";

export default async function BranchesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb.from("profiles").select("org_id, role_key").eq("id", user.id).single();
  if (!profile) return null;

  // Creating a branch is owner/admin (mirrors createBranch()); managers get a read view.
  const canCreate = ["owner", "admin"].includes(profile.role_key ?? "");

  const { data: branches } = await sb
    .from("branches")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("name");

  const rows = branches ?? [];
  const activeCount = rows.filter((b: any) => b.is_active).length;
  const defaultCount = rows.filter((b: any) => b.is_default).length;
  const missingContact = rows.filter((b: any) => !b.phone && !b.email).length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Branches</h1>
          <p className="text-sm text-slate-500">Manage all your store locations</p>
        </div>
        {canCreate && <Link href="/branches/new" className="btn btn-primary">+ New Branch</Link>}
      </div>

      <ModuleKpiGrid items={[{label:"Total branches",value:rows.length,detail:"Branches in your organization"},{label:"Active",value:activeCount,tone:"success",detail:"Currently enabled locations"},{label:"Default branch",value:defaultCount,detail:"Default location configured"},{label:"Missing contact",value:missingContact,tone:missingContact?"warning":"success",detail:"Branches without phone or email"}]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches?.map((b: any) => (
          <Link key={b.id} href={`/branches/${b.id}`} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-navy-900">{b.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{b.address || "No address"}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${b.is_default ? "bg-gold-100 text-gold-700" : "bg-slate-100 text-slate-600"}`}>
                {b.is_default ? "Default" : "Active"}
              </span>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-slate-500">
              <span>Code: {b.code || "—"}</span>
              <span>{b.is_active ? "Active" : "Inactive"}</span>
            </div>
          </Link>
        ))}
      </div>

      {(!branches || branches.length === 0) && (
        <div className="card p-12 text-center text-slate-500">
          <p className="text-lg font-medium">No branches yet</p>
          <p className="text-sm mt-1">Create your first branch to get started</p>
          {canCreate && <Link href="/branches/new" className="btn btn-primary mt-4 inline-block">Create Branch</Link>}
        </div>
      )}
    </div>
  );
}
