import { cache } from "react";
import { supabaseFresh } from "./supabase/server";
import { getOrgId } from "./tenant";
export type GuideBody = { sections?: { heading?: string; body?: string; icon?: string }[]; table?: { headers: string[]; rows: string[][] }; stats?: { value: string; label: string }[]; [k: string]: any };
export type SitePage = { slug: string; kind: string; title: string; subtitle: string | null; hero_image: string | null; body: GuideBody; show_in_nav?: boolean };
/** One DB read per slug per render. Returns null when the operator hid/deleted the page. */
export const getPage = cache(async (slug: string): Promise<SitePage | null> => {
  try {
    const org = await getOrgId();
    const { data } = await supabaseFresh().from("site_pages").select("slug,kind,title,subtitle,hero_image,body").eq("org_id", org).eq("slug", slug).eq("is_active", true).maybeSingle();
    return (data as SitePage) ?? null;
  } catch { return null; }
});
