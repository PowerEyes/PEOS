import { supabaseServer } from "@/lib/supabase/server";
import { PurchasesView } from "./view";
import { getScopeCtx } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Orders – PowerOS" };

export default async function Page() {
  const sb = supabaseServer(), { only } = await getScopeCtx();
  const [{ data: pos }, { data: suppliers }, { data: branches }, { data: products }] = await Promise.all([
    only(sb.from("purchase_orders"))
      .select("*")
      .order("order_date", { ascending: false })
      .order("po_no", { ascending: false })
      .limit(500),
    sb.from("suppliers")
      .select("id,name,gstin,state,status")
      .eq("status", "active")
      .order("name"),
    sb.from("branches")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    sb.from("products")
      .select("id,sku,model,kind,cost_price,selling_price,tax_pct,hsn,brands(name)")
      .eq("status", "active")
      .order("model")
      .limit(2000),
  ]);

  return (
    <PurchasesView
      pos={(pos ?? []) as any}
      suppliers={(suppliers ?? []) as any}
      branches={(branches ?? []) as any}
      products={(products ?? []) as any}
    />
  );
}
