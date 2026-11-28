import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { StockAdjustmentsView } from "./view";

export default async function Page() {
  const sb = supabaseServer();
  const { only, scope } = await getScopeCtx();
  const [{ data: branches }, { data: products }, { data: moves }, { data: profiles }, { data: perms }, { data: { user } }] = await Promise.all([
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("products").select("id, model, sku, barcode, brands(name), stock(branch_id, qty)").order("created_at", { ascending: false }).limit(1000),
    // Fetch all reasons once; the view defaults to human-entered ones and offers
    // a toggle for sales/purchases/transfers/audits when a full trail is needed.
    only(sb.from("stock_movements")
      .select("id, branch_id, product_id, delta, reason, note, created_by, created_at, products(model, sku, brands(name))"))
      .order("created_at", { ascending: false }).limit(200),
    // stock_movements.created_by has no FK to profiles, so names are joined here.
    sb.from("profiles").select("id, full_name"),
    sb.rpc("my_permissions"),
    sb.auth.getUser(),
  ]);
  const canAdjust = perms?.includes("stock_adjust") ?? false;
  return (
    <StockAdjustmentsView
      branches={(branches ?? []) as any[]}
      products={(products ?? []) as any[]}
      moves={(moves ?? []) as any[]}
      profiles={(profiles ?? []) as any[]}
      scope={scope}
      canAdjust={canAdjust}
      me={user?.id ?? ""}
    />
  );
}
