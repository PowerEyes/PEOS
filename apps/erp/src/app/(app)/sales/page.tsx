import { getScopeCtx } from "@/lib/branch-scope";
import { supabaseServer } from "@/lib/supabase/server";
import { SalesView } from "./view";
import { getSettings } from "@/lib/settings";
export default async function Page() {
  const sb = supabaseServer();
  const { only, scope } = await getScopeCtx();
  const [s, p, c, b, lp, lo, st] = await Promise.all([
    only(
      sb
        .from("sales")
        .select(
          "id, code, kind, status, payment_status, grand_total, paid_total, needs_lab, valid_until, created_at, customers!sales_customer_id_fkey(full_name, phone, vision_id)",
        ),
    )
      .order("created_at", { ascending: false })
      .limit(300),
    sb
      .from("products")
      .select(
        "id, kind, sku, barcode, model, selling_price, mrp, tax_pct, power_eligible, images, brands(name), stock(branch_id, qty)",
      )
      .eq("status", "active")
      .limit(1000),
    sb
      .from("customers")
      .select("id, full_name, phone, vision_id")
      .order("full_name")
      .limit(1000),
    sb.from("branches").select("id, name").eq("is_active", true).order("name"),
    sb
      .from("lens_packages")
      .select("*")
      .eq("status", "active")
      .order("display_order"),
    sb
      .from("lens_options")
      .select("*")
      .eq("status", "active")
      .order("display_order"),
    sb
      .from("org_settings")
      .select("key, value")
      .eq("key", "quotation_valid_days"),
  ]);
  const set = await getSettings();
  const days = set.quoteDays;
  return (
    <SalesView
      sales={(s.data ?? []) as any}
      products={(p.data ?? []) as any}
      customers={c.data ?? []}
      branches={b.data ?? []}
      packages={(lp.data ?? []) as any}
      options={(lo.data ?? []) as any}
      quoteDays={days}
      gst={set.gst}
      defaultSupplyType={set.defaultSupplyType}
      defaultStateOfSupply={set.defaultStateOfSupply}
    />
  );
}
