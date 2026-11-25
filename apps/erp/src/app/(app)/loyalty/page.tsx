import { supabaseServer } from "@/lib/supabase/server";

export default async function LoyaltyPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await sb
    .from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.org_id) {
    return <div className="card p-6 text-sm text-rose-600">Your organization context could not be verified. Contact your administrator.</div>;
  }

  const { data: balances, error } = await sb
    .from("customer_loyalty_balance")
    .select("customer_id, points")
    .eq("org_id", profile.org_id)
    .order("points", { ascending: false })
    .limit(100);

  const ids = (balances ?? []).map((row: any) => row.customer_id);
  const { data: customers, error: customerError } = ids.length
    ? await sb.from("customers").select("id, full_name, customer_code, vision_id").in("id", ids)
    : { data: [], error: null };
  const customerById = new Map((customers ?? []).map((customer: any) => [customer.id, customer]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Loyalty & Referrals</h1>
        <p className="text-sm text-slate-500">Customer balances from the organization loyalty ledger</p>
      </div>
      {error || customerError ? <div role="alert" className="card p-5 text-sm text-rose-600">Loyalty balances could not be loaded.</div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left p-3">Customer</th><th className="text-left p-3">Vision ID</th><th className="text-right p-3">Points</th></tr></thead>
              <tbody>
                {(balances ?? []).map((row: any) => {
                  const customer: any = customerById.get(row.customer_id);
                  return <tr key={row.customer_id} className="border-t">
                    <td className="p-3 font-medium">{customer?.full_name ?? "Customer record unavailable"}</td>
                    <td className="p-3">{customer?.vision_id ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{Number(row.points ?? 0).toLocaleString("en-IN")}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {(!balances || balances.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No loyalty balances recorded.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
