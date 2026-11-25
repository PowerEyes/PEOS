import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { InventoryView } from "./view";
import { getSettings } from "@/lib/settings";
import { DataLoadError } from "@/components/DataLoadError";
export default async function Page() {
  const sb = supabaseServer();
  const { scope } = await getScopeCtx();
  const [p, b, br, lp, lo, costs, mgr] = await Promise.all([
    sb.from("products").select("*, brands(name), stock(branch_id, qty, reorder_level)").order("created_at", { ascending: false }).limit(1000),
    sb.from("brands").select("id, name").order("name"), sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("lens_packages").select("*").order("display_order"), sb.from("lens_options").select("*").order("grp").order("display_order"),
    sb.from("product_costs").select("product_id, cost_price"), sb.rpc("is_manager")]);
  if ([p.error, b.error, br.error, lp.error, lo.error].some(Boolean)) return <DataLoadError title="Inventory workspace could not be loaded" message="Required catalogue, stock, brand, branch or lens catalogue data is unavailable. Retry before making stock decisions." />;
  // Costs come back only for managers/admins/owners (row-level security); everyone else gets an empty list.
  const canSeeCost = mgr.data === true; const costMap = new Map((costs.data ?? []).map((c: any) => [c.product_id, c.cost_price]));
  const gst = (await getSettings()).gst;
  return <InventoryView gst={gst} canSeeCost={canSeeCost} products={((p.data ?? []) as any[]).map((x) => ({ ...(canSeeCost ? { ...x, cost_price: costMap.get(x.id) ?? null } : x), stock: scope ? (x.stock ?? []).filter((k: any) => k.branch_id === scope) : x.stock }))} brands={b.data ?? []} branches={br.data ?? []} packages={(lp.data ?? []) as any} options={(lo.data ?? []) as any} />;
}
