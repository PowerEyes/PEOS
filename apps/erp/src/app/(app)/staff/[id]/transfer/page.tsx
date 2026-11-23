import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function StaffTransferPage({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: staff } = await sb.from("staff_profiles").select("full_name, branch_id, tenant_id").eq("id", params.id).single();
  if (!staff) notFound();
  const { data: branches } = await sb.from("branches").select("id, name").eq("tenant_id", staff.tenant_id);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Transfer Employee</h1>
      <p className="text-sm text-slate-500">Transfer {staff.full_name} to another branch</p>
      <form className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Target Branch *</label>
          <select name="target_branch" required className="field w-full">
            {branches?.filter((b: any) => b.id !== staff.branch_id).map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Effective Date</label>
          <input name="effective_date" type="date" className="field w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea name="reason" className="field w-full" rows={3} />
        </div>
        <button type="submit" className="btn btn-primary w-full">Transfer</button>
      </form>
    </div>
  );
}