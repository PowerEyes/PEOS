import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatform } from "@/lib/platform-guard";
import { PlanRow } from "./plan-row";

export const dynamic = "force-dynamic";

export default async function PlatformPlans() {
  await requirePlatform();
  const admin = supabaseAdmin();
  const { data: plans } = await admin.from("billing_plans").select("*").order("display_order");
  const money = (p: number | null) => (p == null ? "Custom" : `₹${(Number(p) / 100).toLocaleString("en-IN")}`);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Subscription plans</h2>
        <p className="text-sm text-slate-400">Plans, pricing, trial/grace windows, limits and feature entitlements.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Trial</th><th className="px-4 py-3">Branches</th>
              <th className="px-4 py-3">Employees</th><th className="px-4 py-3">Customers</th>
              <th className="px-4 py-3">Active</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(plans ?? []).map((p: any) => (
              <PlanRow key={p.id} plan={p} money={money} />
            ))}
            {!(plans ?? []).length && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No plans. Run the subscription migration.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
