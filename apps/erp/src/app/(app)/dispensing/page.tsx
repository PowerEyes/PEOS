import { supabaseServer } from "@/lib/supabase/server";

export default async function DispensingPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("staff_profiles").select("tenant_id, branch_id").eq("user_id", user.id).single();
  const { data: orders } = await sb.from("sales").select("id, order_number, customer_name, total, status").eq("branch_id", profile?.branch_id).eq("status", "ready").order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Dispensing & Collection</h1>
      <p className="text-sm text-slate-500">Spectacle dispensing and collection</p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-3">Order</th><th className="text-left p-3">Customer</th><th className="text-right p-3">Total</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr></thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-medium">{o.order_number}</td>
                <td className="p-3">{o.customer_name}</td>
                <td className="p-3 text-right">₹{o.total?.toLocaleString()}</td>
                <td className="p-3"><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">{o.status}</span></td>
                <td className="p-3"><button className="btn btn-outline text-sm">Dispense</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!orders || orders.length === 0) && <p className="p-6 text-sm text-slate-500 text-center">No orders ready for dispensing</p>}
      </div>
    </div>
  );
}