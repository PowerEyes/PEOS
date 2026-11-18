import { cache } from "react";
import { supabasePublic } from "./supabase/server";

// Public site settings — read live from the public_site_settings view
// (migration 0026). Everything falls back to defaults when the view or a
// key is missing, so the site never breaks before migrations run.
export type SiteSettings = {
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
};

export const DEFAULT_SITE: SiteSettings = {
  whatsappNumber: "919840496404",
  instagram: "",
  analyticsId: "",
};

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const { data, error } = await supabasePublic()
      .from("public_site_settings")
      .select("key, value");
    if (error) return { ...DEFAULT_SITE };
    const s: SiteSettings = { ...DEFAULT_SITE };
    for (const r of data ?? []) {
      const v = typeof r.value === "string" ? r.value : "";
      if (r.key === "whatsapp_number") {
        const d = v.replace(/\D/g, "");
        if (d) s.whatsappNumber = d;
      } else if (r.key === "instagram") {
        s.instagram = v;
      } else if (r.key === "analytics_id") {
        s.analyticsId = v;
      }
    }
    return s;
  } catch {
    return { ...DEFAULT_SITE };
  }
});
