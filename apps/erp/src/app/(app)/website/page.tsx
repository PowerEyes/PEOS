import { supabaseServer } from "@/lib/supabase/server";
import { WebsiteController } from "./view";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: content }, { data: products }, { data: reviews }, { data: sections }, { data: analytics }, { data: lensUsage }] = await Promise.all([
    sb.from("website_content").select("*").order("section").order("display_order"),
    sb.from("products").select("id,sku,model,visible_on_website,featured,new_arrival,bestseller,images,status").order("created_at",{ascending:false}).limit(200),
    sb.from("product_reviews").select("*, products(model)").order("created_at",{ascending:false}).limit(100),
    // Sections registry (0023) — drives both the Homepage grouping order and the
    // drag-to-reorder panel. Staff RLS returns every row regardless of `enabled`,
    // so a hidden section stays editable here.
    sb.from("website_sections").select("*").order("display_order"),
    // Read the same key the storefront uses so the Analytics tab can report the
    // real provider/status instead of a placeholder.
    sb.from("org_settings").select("value").eq("key", "analytics_id").maybeSingle(),
    // Choose-lens usage cards (storefront_checkout_compat). An empty result is
    // fine — the controller shows the built-in fallback and can seed the table.
    sb.from("website_lens_usage").select("*").order("display_order"),
  ]);
  const analyticsId = typeof analytics?.value === "string" ? analytics.value : "";
  return <WebsiteController
    content={content??[]} products={products??[]} reviews={reviews??[]} sections={sections??[]}
    lensUsage={lensUsage??[]}
    analyticsId={analyticsId}
    // The preview iframe is cross-origin, so both values come from the server:
    // NEXT_PUBLIC_WEB_URL isn't guaranteed to be set in the ERP's own env. The
    // preview key is a studio-only URL token used to build the iframe src and
    // explain preview status to the operator.
    siteUrl={process.env.NEXT_PUBLIC_WEB_URL || ""}
    previewKey={process.env.SITE_PREVIEW_KEY || null} />;
}
