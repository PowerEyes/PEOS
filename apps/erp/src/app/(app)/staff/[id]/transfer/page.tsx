import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { transferStaff } from "./actions";

export default async function StaffTransferPage({ params, searchParams }: { params: { id: string }; searchParams: { e?: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) notFound();

  const { data: me } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!me?.org_id) notFound();

  const { data: staff } = await sb.from("profiles")
    .select("id, full_name, branch_id, org_id, role_key")
    .eq("id", params.id).eq("org_id", me.org_id)
    .single();
  if (!staff) notFound();

  const { data: branches } = await sb.from("branches").select("id, name, is_active").eq("org_id", staff.org_id).eq("is_active", true).order("name");

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Transfer Employee</h1>
        <p className="text-sm text-slate-500">Transfer {staff.full_name || "this employee"} to another branch</p>
      </div>
      {searchParams.e && (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{searchParams.e}</div>
      )}
      <form action={transferStaff} className="card p-6 space-y-4">
        <input type="hidden" name="id" value={staff.id} />
        <input type="hidden" name="current_branch" value={staff.branch_id ?? ""} />
        <div>
          <label className="block text-sm font-medium mb-1">Target Branch *</label>
          <select name="target_branch" required className="field w-full">
            {(branches ?? []).filter((b: any) => b.id !== staff.branch_id).map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {(!branches || branches.length <= 1) && (
            <p className="text-xs text-slate-500 mt-1">Add another branch first — there is nowhere else to move this employee.</p>
          )}
        </div>
        <button type="submit" className="btn btn-primary w-full">Transfer</button>
      </form>
    </div>
  );
}
