import { supabaseServer } from "@/lib/supabase/server";
import { PurchasesView } from "./view";
import { getScopeCtx } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Orders – PowerOS" };

export default async function Page() {
  const sb = supabaseServer(), { only } = await getScopeCtx();
  const [{ data: pos }, { data: suppliers }, { data: branches }, { data: products }, { data: costs }] = await Promise.all([
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
      .select("id,sku,model,kind,selling_price,tax_pct,hsn,brands(name)")
      .eq("status", "active")
      .order("model")
      .limit(2000),
    // Cost is a separate manager-only table; the PO picker needs it to prefill rates.
    sb.from("product_costs").select("product_id,cost_price"),
  ]);

  const costByProduct = new Map((costs ?? []).map((c: any) => [c.product_id, c.cost_price]));
  const productsWithCost = ((products ?? []) as any[]).map((p) => ({
    ...p,
    cost_price: costByProduct.get(p.id) ?? null,
  }));

  return (
    <PurchasesView
      pos={(pos ?? []) as any}
      suppliers={(suppliers ?? []) as any}
      branches={(branches ?? []) as any}
      products={productsWithCost}
    />
  );
}
