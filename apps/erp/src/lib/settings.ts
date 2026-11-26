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
  defaultSupplyType: "intrastate" | "interstate";
  defaultStateOfSupply: string;
  whatsappNumber: string;
  instagram: string;
  analyticsId: string;
  codePrefixes: Record<string, string>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  gst: true,
  gstin: "",
  maxDiscount: 10,
  quoteDays: 14,
  labDays: 5,
  invoiceFooter: "",
  defaultSupplyType: "intrastate",
  defaultStateOfSupply: "Tamil Nadu",
  whatsappNumber: "",
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
    const { data: rows } = await supabaseServer()
      .from("org_settings")
      .select("key, value");
    const s: AppSettings = { ...DEFAULT_SETTINGS, codePrefixes: {} };
    for (const r of rows ?? []) {
      switch (r.key) {
        case "gst_enabled":
          s.gst = r.value === true || r.value === "true";
          break;
        case "gstin":
          s.gstin = str(r.value);
          break;
        case "max_staff_discount_pct":
          s.maxDiscount = num(r.value, 10);
          break;
        case "quotation_valid_days":
          s.quoteDays = num(r.value, 14);
          break;
        case "lab_lead_days":
          s.labDays = num(r.value, 5);
          break;
        case "invoice_footer":
          s.invoiceFooter = str(r.value);
          break;
        case "default_supply_type":
          s.defaultSupplyType =
            r.value === "interstate" ? "interstate" : "intrastate";
          break;
        case "default_state_of_supply":
          s.defaultStateOfSupply = str(r.value) || "Tamil Nadu";
          break;
        case "whatsapp_number":
          s.whatsappNumber = str(r.value).replace(/\D/g, "");
          break;
        case "instagram":
          s.instagram = str(r.value);
          break;
        case "analytics_id":
          s.analyticsId = str(r.value);
          break;
        case "code_prefixes":
          s.codePrefixes =
            r.value && typeof r.value === "object" && !Array.isArray(r.value)
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
