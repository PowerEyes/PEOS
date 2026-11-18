import { supabaseServer } from "./supabase/server";

// org_settings is a key/value table (org_id, key, value jsonb) — every read/write
// must go through keys, never wide-row columns.
export type AppSettings = {
  gst: boolean;
  gstin: string;
  maxDiscount: number;
  quoteDays: number;
  labDays: number;
  invoiceFooter: string;
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
  codePrefixes: Record<string, string>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  gst: true,
  gstin: "",
  maxDiscount: 20,
  quoteDays: 7,
  labDays: 5,
  invoiceFooter: "",
  whatsappNumber: "9840496404",
  instagram: "",
  analyticsId: "",
  codePrefixes: {},
};

const num = (v: unknown, d: number) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(n) ? d : n;
};
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function getSettings(): Promise<AppSettings> {
  try {
    const { data: rows } = await supabaseServer().from("org_settings").select("key, value");
    const s: AppSettings = { ...DEFAULT_SETTINGS, codePrefixes: {} };
    for (const r of rows ?? []) {
      switch (r.key) {
        case "gst_enabled": s.gst = r.value === true || r.value === "true"; break;
        case "gstin": s.gstin = str(r.value); break;
        case "max_staff_discount_pct": s.maxDiscount = num(r.value, 20); break;
        case "quotation_valid_days": s.quoteDays = num(r.value, 7); break;
        case "lab_lead_days": s.labDays = num(r.value, 5); break;
        case "invoice_footer": s.invoiceFooter = str(r.value); break;
        case "whatsapp_number": s.whatsappNumber = str(r.value).replace(/\D/g, ""); break;
        case "instagram": s.instagram = str(r.value); break;
        case "analytics_id": s.analyticsId = str(r.value); break;
        case "code_prefixes":
          s.codePrefixes = r.value && typeof r.value === "object" && !Array.isArray(r.value)
            ? (r.value as Record<string, string>)
            : {};
          break;
      }
    }
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS, codePrefixes: {} };
  }
}
