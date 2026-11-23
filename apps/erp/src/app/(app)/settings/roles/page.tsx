import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

// The tenant's role model is fixed: role keys on profiles plus per-org
// overrides in role_permissions (there is no free-form `roles` table).
const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full company-wide access",
  admin: "Company administration",
  branch_manager: "Branch-level management",
  staff: "Standard staff access",
  optometrist: "Clinical access",
  sales_executive: "Sales & POS",
  cashier: "Billing & payments",
  inventory_manager: "Stock management",
  lab_technician: "Lab operations",
  accountant: "Finance & accounting",
  receptionist: "Front desk",
};

export default async function RolesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb.from("profiles").select("role_key").eq("id", user.id).single();
  if (profile?.role_key !== "owner" && profile?.role_key !== "admin") return null;

  const [{ data: members }, { data: overrides }] = await Promise.all([
    sb.from("profiles").select("role_key"),
    sb.from("role_permissions").select("role_key, permission, allowed").eq("allowed", true),
  ]);

  const roleKeys = [...new Set([...Object.keys(ROLE_DESCRIPTIONS), ...(members ?? []).map((m: any) => m.role_key)])]
    .filter((k): k is string => !!k)
    .sort((a, b) => (ROLE_DESCRIPTIONS[a] ? 0 : 1) - (ROLE_DESCRIPTIONS[b] ? 0 : 1) || a.localeCompare(b));

  const memberCount = (key: string) => (members ?? []).filter((m: any) => m.role_key === key).length;
  const grantCount = (key: string) => (overrides ?? []).filter((o: any) => o.role_key === key).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-slate-500">Who can do what, and which branches they can reach</p>
        </div>
        <Link href="/staff" className="btn btn-primary">Edit permissions</Link>
      </div>

      <div className="grid gap-4">
        {roleKeys.map((key) => (
          <div key={key} className="card p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-navy-900">{ROLE_DESCRIPTIONS[key] || key}</h3>
              <p className="text-sm text-slate-500">{ROLE_DESCRIPTIONS[key] ? key.replace(/_/g, " ") : "Custom role"}</p>
              <p className="text-xs text-slate-400 mt-1">
                {memberCount(key)} member{memberCount(key) === 1 ? "" : "s"}
                {grantCount(key) > 0 ? ` · ${grantCount(key)} extra permission${grantCount(key) === 1 ? "" : "s"} granted` : " · default permissions"}
              </p>
            </div>
            <Link href="/staff" className="btn btn-outline text-sm">Permissions</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
