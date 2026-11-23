import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function RolesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, role").eq("user_id", user.id).single();
  if (profile?.role !== "owner" && profile?.role !== "admin") return null;

  const { data: roles } = await sb.from("roles").select("*").eq("tenant_id", profile.tenant_id).order("name");

  const defaultRoles = [
    { name: "Owner", description: "Full company-wide access", system: true },
    { name: "Admin", description: "Company administration", system: true },
    { name: "Branch Manager", description: "Branch-level management", system: true },
    { name: "Optometrist", description: "Clinical access", system: true },
    { name: "Sales Executive", description: "Sales & POS", system: true },
    { name: "Cashier", description: "Billing & payments", system: true },
    { name: "Inventory Manager", description: "Stock management", system: true },
    { name: "Lab Technician", description: "Lab operations", system: true },
    { name: "Accountant", description: "Finance & accounting", system: true },
    { name: "Receptionist", description: "Front desk", system: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Roles & Permissions</h1>
          <p className="text-sm text-slate-500">Define roles and their permissions</p>
        </div>
        <Link href="/settings/roles/new" className="btn btn-primary">+ New Role</Link>
      </div>

      <div className="grid gap-4">
        {(roles || defaultRoles).map((r: any) => (
          <div key={r.name} className="card p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-navy-900">{r.name}</h3>
              <p className="text-sm text-slate-500">{r.description}</p>
              {r.system && <span className="text-xs text-slate-400 mt-1">System role</span>}
            </div>
            <div className="flex gap-2">
              <Link href={`/settings/roles/${r.id || r.name}/permissions`} className="btn btn-outline text-sm">Permissions</Link>
              {!r.system && <Link href={`/settings/roles/${r.id}/edit`} className="btn btn-outline text-sm">Edit</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}