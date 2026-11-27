/**
 * Canonical setting keys. Legacy keys are the strings already stored in
 * org_settings (or wide-column references) and are mapped here so that old
 * data keeps working while readers move to the catalog.
 */
export const SETTING_KEYS = [
  "tax.gst_enabled",
  "tax.gstin",
  "tax.default_supply_type",
  "tax.default_state_of_supply",
  "tax.invoice_footer",
  "sales.max_discount_pct",
  "sales.quote_valid_days",
  "lab.lead_days",
  "numbering.code_prefixes",
  "website.whatsapp_number",
  "website.instagram",
  "website.analytics_id",
  "customers.default_city",
  "customers.default_state",
  "customers.default_pincode",
  "system.home_state_code",
  "system.go_live",
  "business.legal_name",
  "business.business_email",
  "business.business_phone",
  "business.billing_address",
  "business.timezone",
  "business.currency",
  "business.financial_year_start_month",
  "branches.legal_name",
  "branches.gstin",
  "branches.timezone",
  "branches.opening_hours",
  "branches.invoice_terms",
  "branches.is_default_pickup",
  "branches.is_active",
  "crm.rx_reminder_enabled",
  "crm.rx_reminder_days_before",
  "crm.birthday_enabled",
  "crm.birthday_coupon_pct",
  "crm.order_updates_enabled",
  "crm.cart_recovery_enabled",
  "crm.cart_recovery_hours",
  "crm.wa_provider",
  "loyalty.earn_rate",
  "integrations.razorpay_key_id",
  "integrations.razorpay_key_secret",
  "integrations.razorpay_webhook_secret",
  "integrations.ocr_service_token",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const MODULE_SETTING_PREFIX = "module.";

export function moduleSettingKey(moduleKey: string): string {
  return `${MODULE_SETTING_PREFIX}${moduleKey}`;
}

const LEGACY_TO_CANONICAL: Readonly<Record<string, SettingKey>> = {
  gst_enabled: "tax.gst_enabled",
  gstin: "tax.gstin",
  default_supply_type: "tax.default_supply_type",
  default_state_of_supply: "tax.default_state_of_supply",
  invoice_footer: "tax.invoice_footer",
  max_staff_discount_pct: "sales.max_discount_pct",
  quotation_valid_days: "sales.quote_valid_days",
  lab_lead_days: "lab.lead_days",
  code_prefixes: "numbering.code_prefixes",
  whatsapp_number: "website.whatsapp_number",
  instagram: "website.instagram",
  analytics_id: "website.analytics_id",
  default_city: "customers.default_city",
  default_state: "customers.default_state",
  default_pincode: "customers.default_pincode",
  home_state_code: "system.home_state_code",
  go_live: "system.go_live",
};

const CANONICAL_TO_LEGACY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL).map(([legacy, canonical]) => [canonical, legacy]),
);

export function canonicalSettingKey(key: string): string {
  return LEGACY_TO_CANONICAL[key] ?? key;
}

export function legacySettingKey(key: string): string | undefined {
  return CANONICAL_TO_LEGACY[key];
}
