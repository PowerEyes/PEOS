import { supabaseServer } from "@/lib/supabase/server";
import { InventoryView } from "./view";
import { getSettings } from "@/lib/settings";
export default async function Page() {
  const sb = supabaseServer();
  const [p, b, br, lp, lo] = await Promise.all([
    sb.from("products").select("*, brands(name), stock(branch_id, qty, reorder_level)").order("created_at", { ascending: false }).limit(1000),
    sb.from("brands").select("id, name").order("name"), sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb.from("lens_packages").select("*").order("display_order"), sb.from("lens_options").select("*").order("grp").order("display_order")]);
  const gst = (await getSettings()).gst;
  return <InventoryView gst={gst} products={(p.data ?? []) as any} brands={b.data ?? []} branches={br.data ?? []} packages={(lp.data ?? []) as any} options={(lo.data ?? []) as any} />;
}
