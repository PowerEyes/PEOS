import { supabaseServer } from "@/lib/supabase/server";
import { WebsiteController } from "./view";
export default async function Page() {
  const sb = supabaseServer();
  const [{ data: content }, { data: products }, { data: reviews }, { data: sections }] = await Promise.all([
    sb.from("website_content").select("*").order("section").order("display_order"),
    sb.from("products").select("id,sku,model,visible_on_website,featured,new_arrival,bestseller,images,status").order("created_at",{ascending:false}).limit(200),
    sb.from("product_reviews").select("*, products(model)").order("created_at",{ascending:false}).limit(100),
    // Sections registry (0023) — drives both the Homepage grouping order and the
    // drag-to-reorder panel. Staff RLS returns every row regardless of `enabled`,
    // so a hidden section stays editable here.
    sb.from("website_sections").select("*").order("display_order"),
  ]);
  return <WebsiteController
    content={content??[]} products={products??[]} reviews={reviews??[]} sections={sections??[]}
    // The preview iframe is cross-origin, so both values come from the server:
    // NEXT_PUBLIC_WEB_URL isn't guaranteed to be set in the ERP's own env, and
    // SITE_PREVIEW_KEY must never reach a browser bundle we don't control.
    siteUrl={process.env.NEXT_PUBLIC_WEB_URL || ""}
    previewKey={process.env.SITE_PREVIEW_KEY || null} />;
}
