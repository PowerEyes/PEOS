import { getOrgId } from "@/lib/tenant";
import { cache } from "react";
import { supabasePublic } from "./supabase/server";

// Public site settings — read live from the public_site_settings view
// (migration 0026). Everything falls back to defaults when the view or a
// key is missing, so the site never breaks before migrations run.
export type SiteSettings = {
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
  /** Store phone numbers (digits only) from active branches, main store first. */
  phones: string[];
  hours: string;
};

export const DEFAULT_SITE: SiteSettings = {
  whatsappNumber: "",
  instagram: "",
  analyticsId: "",
  phones: [],
  hours: "Mon–Sun 10 AM – 9 PM",
};

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const { data, error } = await supabasePublic()
      .from("public_site_settings")
      .select("key, value");
    if (error) return DEFAULT_SITE;
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
    try {
      const { data: br } = await supabasePublic().from("branches").select("phone,opening_hours,is_default_pickup").eq("is_active", true).order("is_default_pickup",{ascending:false}).order("name");
      s.phones = (br ?? []).map((b: any) => String(b.phone ?? "").replace(/\D/g, "").slice(-10)).filter((x: string) => x.length === 10);
      const firstHours=(br??[])[0]?.opening_hours;
      if(firstHours&&typeof firstHours==="object")s.hours=Object.entries(firstHours).map(([day,h]:[string,any])=>`${day.slice(0,3)} ${h.closed?"Closed":`${h.open}–${h.close}`}`).join(" · ");
    } catch {}
    if (!s.phones.length && s.whatsappNumber) s.phones = [s.whatsappNumber.slice(-10)];
    return s;
  } catch {
    return DEFAULT_SITE;
  }
});

/** Display name of this website's organisation (database-driven; the anon key can no longer read the organizations table). */
export const getStoreName = cache(async (): Promise<string> => {
  try { const { data } = await supabasePublic().rpc("public_store_name", { p_org: await getOrgId() }); return (data as string) || "Our store"; } catch { return "Our store"; }
});
