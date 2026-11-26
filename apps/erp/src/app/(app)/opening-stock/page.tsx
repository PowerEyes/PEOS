import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { OpeningStockView } from "./view";

export default async function Page() {
  const sb = supabaseServer();
  const { scope } = await getScopeCtx();
  const [{ data: branches }, { data: products }, { data: perms }] = await Promise.all([
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("products").select("id, model, sku, barcode, brands(name), stock(branch_id, qty)").order("created_at", { ascending: false }).limit(2000),
    sb.rpc("my_permissions"),
  ]);
  return (
    <OpeningStockView
      branches={(branches ?? []) as any[]}
      products={(products ?? []) as any[]}
      scope={scope}
      canAdjust={perms?.includes("stock_adjust") ?? false}
    />
  );
}
