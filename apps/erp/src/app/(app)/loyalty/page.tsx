import { supabaseServer } from "@/lib/supabase/server";

export default async function LoyaltyPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id").eq("user_id", user.id).single();
  const { data: customers } = await sb.from("customers").select("id, name, loyalty_points").eq("tenant_id", profile?.tenant_id).order("loyalty_points", { ascending: false }).limit(20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Loyalty & Referrals</h1>
      <p className="text-sm text-slate-500">Customer loyalty points and referral tracking</p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Customer</th><th className="text-right p-3">Points</th></tr></thead>
          <tbody>
            {customers?.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-right">{c.loyalty_points || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!customers || customers.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No loyalty data</p>}
      </div>
    </div>
  );
}