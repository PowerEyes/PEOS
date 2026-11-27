import { moduleSettingKey } from "./keys";
import { MODULE_REGISTRY } from "./modules";
import type { SettingDefinition, SettingValueType, SnapshotPolicy } from "./types";

type DefineInput = Pick<
  SettingDefinition,
  "key" | "module" | "section" | "label" | "scope" | "valueType" | "defaultValue"
> &
  Partial<SettingDefinition>;

function schemaFor(valueType: SettingValueType, allowedValues?: readonly string[] | null): Record<string, unknown> {
  if (valueType === "enum") return { type: "string", enum: allowedValues ?? [] };
  if (valueType === "json") return { type: ["object", "array"] };
  return { type: valueType === "number" ? "number" : valueType };
}

function define(input: DefineInput): SettingDefinition {
  const base: Pick<
    SettingDefinition,
    "isPublic" | "isSecret" | "requiresApproval" | "affectsTransactions" | "snapshotPolicy"
  > = {
    isPublic: false,
    isSecret: false,
    requiresApproval: false,
    affectsTransactions: false,
    snapshotPolicy: "none" as SnapshotPolicy,
  };
  const merged = { ...base, ...input };
  return {
    ...merged,
    jsonSchema: merged.jsonSchema ?? schemaFor(merged.valueType, merged.allowedValues),
  };
}

/**
 * Code-level fallback catalog. It is used when the DB catalog is not applied
 * yet and superseded key-by-key when catalog rows are available.
 */
export const BUILTIN_SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  define({ key: "tax.gst_enabled", legacyKey: "gst_enabled", module: "tax", section: "tax", label: "GST enabled", scope: "org", valueType: "boolean", defaultValue: true, writeRole: "owner", affectsTransactions: true, snapshotPolicy: "order", requiresApproval: true, sortOrder: 10 }),
  define({ key: "tax.gstin", legacyKey: "gstin", module: "tax", section: "tax", label: "GSTIN", scope: "org", valueType: "string", defaultValue: "", writeRole: "owner", affectsTransactions: true, snapshotPolicy: "invoice", requiresApproval: true, sortOrder: 20 }),
  define({ key: "tax.default_supply_type", legacyKey: "default_supply_type", module: "tax", section: "tax", label: "Default supply type", scope: "org", valueType: "enum", defaultValue: "intrastate", allowedValues: ["intrastate", "interstate"], writeRole: "owner", affectsTransactions: true, snapshotPolicy: "order", sortOrder: 30 }),
  define({ key: "tax.default_state_of_supply", legacyKey: "default_state_of_supply", module: "tax", section: "tax", label: "Default state of supply", scope: "org", valueType: "string", defaultValue: "Tamil Nadu", writeRole: "owner", affectsTransactions: true, snapshotPolicy: "order", sortOrder: 40 }),
  define({ key: "tax.invoice_footer", legacyKey: "invoice_footer", module: "tax", section: "tax", label: "Invoice footer", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", affectsTransactions: true, snapshotPolicy: "invoice", sortOrder: 50 }),
  define({ key: "sales.max_discount_pct", legacyKey: "max_staff_discount_pct", module: "sales", section: "sales", label: "Maximum staff discount %", scope: "org", valueType: "number", defaultValue: 10, writeRole: "owner", affectsTransactions: true, snapshotPolicy: "order", sortOrder: 60 }),
  define({ key: "sales.quote_valid_days", legacyKey: "quotation_valid_days", module: "sales", section: "sales", label: "Quotation valid days", scope: "org", valueType: "number", defaultValue: 14, writeRole: "admin", affectsTransactions: true, snapshotPolicy: "quote", sortOrder: 70 }),
  define({ key: "lab.lead_days", legacyKey: "lab_lead_days", module: "workshop", section: "sales", label: "Lab lead days", scope: "org", valueType: "number", defaultValue: 5, writeRole: "admin", affectsTransactions: true, snapshotPolicy: "order", sortOrder: 80 }),
  define({ key: "numbering.code_prefixes", legacyKey: "code_prefixes", module: "numbering", section: "prefixes", label: "Document code prefixes", scope: "org", valueType: "json", defaultValue: {}, writeRole: "owner", affectsTransactions: true, snapshotPolicy: "order", requiresApproval: true, sortOrder: 90 }),
  define({ key: "website.whatsapp_number", legacyKey: "whatsapp_number", module: "website", section: "website", label: "Public WhatsApp number", scope: "org", valueType: "string", defaultValue: "", isPublic: true, writeRole: "admin", sortOrder: 100 }),
  define({ key: "website.instagram", legacyKey: "instagram", module: "website", section: "website", label: "Instagram handle", scope: "org", valueType: "string", defaultValue: "", isPublic: true, writeRole: "admin", sortOrder: 110 }),
  define({ key: "website.analytics_id", legacyKey: "analytics_id", module: "website", section: "website", label: "Analytics ID", scope: "org", valueType: "string", defaultValue: "", isPublic: true, writeRole: "admin", sortOrder: 120 }),
  define({ key: "customers.default_city", legacyKey: "default_city", module: "customers", section: "business", label: "Default city", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", sortOrder: 130 }),
  define({ key: "customers.default_state", legacyKey: "default_state", module: "customers", section: "business", label: "Default state", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", sortOrder: 140 }),
  define({ key: "customers.default_pincode", legacyKey: "default_pincode", module: "customers", section: "business", label: "Default pincode", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", sortOrder: 150 }),
  define({ key: "system.home_state_code", legacyKey: "home_state_code", module: "system", section: "tax", label: "Home state code", scope: "org", valueType: "string", defaultValue: "", writeRole: "owner", affectsTransactions: true, snapshotPolicy: "invoice", requiresApproval: true, sortOrder: 160 }),
  define({ key: "system.go_live", legacyKey: "go_live", module: "system", section: "business", label: "Go-live timestamp", scope: "org", valueType: "string", defaultValue: "", writeRole: "owner", requiresApproval: true, sortOrder: 170 }),

  define({ key: "business.legal_name", module: "business", section: "business", label: "Legal name", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", storageRef: "organizations.legal_name", sortOrder: 180 }),
  define({ key: "business.business_email", module: "business", section: "business", label: "Business email", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", storageRef: "organizations.business_email", sortOrder: 190 }),
  define({ key: "business.business_phone", module: "business", section: "business", label: "Business phone", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", storageRef: "organizations.business_phone", sortOrder: 200 }),
  define({ key: "business.billing_address", module: "business", section: "business", label: "Billing address", scope: "org", valueType: "string", defaultValue: "", writeRole: "admin", storageRef: "organizations.billing_address", sortOrder: 210 }),
  define({ key: "business.timezone", module: "business", section: "business", label: "Timezone", scope: "org", valueType: "string", defaultValue: "Asia/Kolkata", writeRole: "admin", storageRef: "organizations.timezone", sortOrder: 220 }),
  define({ key: "business.currency", module: "business", section: "business", label: "Currency", scope: "org", valueType: "enum", defaultValue: "INR", allowedValues: ["INR"], writeRole: "owner", affectsTransactions: true, snapshotPolicy: "invoice", requiresApproval: true, storageRef: "organizations.currency", sortOrder: 230 }),
  define({ key: "business.financial_year_start_month", module: "finance", section: "tax", label: "Financial year start month", scope: "org", valueType: "number", defaultValue: 4, writeRole: "owner", affectsTransactions: true, snapshotPolicy: "invoice", requiresApproval: true, storageRef: "organizations.financial_year_start_month", sortOrder: 240 }),

  define({ key: "branches.legal_name", module: "branches", section: "business", label: "Branch legal name", scope: "branch", valueType: "string", defaultValue: "", writeRole: "manager", storageRef: "branches.legal_name", sortOrder: 250 }),
  define({ key: "branches.gstin", module: "branches", section: "tax", label: "Branch GSTIN", scope: "branch", valueType: "string", defaultValue: "", writeRole: "owner", affectsTransactions: true, snapshotPolicy: "invoice", requiresApproval: true, storageRef: "branches.gstin", sortOrder: 260 }),
  define({ key: "branches.timezone", module: "branches", section: "business", label: "Branch timezone", scope: "branch", valueType: "string", defaultValue: "Asia/Kolkata", writeRole: "manager", storageRef: "branches.timezone", sortOrder: 270 }),
  define({ key: "branches.opening_hours", module: "branches", section: "business", label: "Opening hours", scope: "branch", valueType: "json", defaultValue: {}, writeRole: "manager", storageRef: "branches.opening_hours", sortOrder: 280 }),
  define({ key: "branches.invoice_terms", module: "branches", section: "tax", label: "Invoice terms", scope: "branch", valueType: "string", defaultValue: "", writeRole: "admin", affectsTransactions: true, snapshotPolicy: "invoice", storageRef: "branches.invoice_terms", sortOrder: 290 }),
  define({ key: "branches.is_default_pickup", module: "branches", section: "business", label: "Default pickup branch", scope: "branch", valueType: "boolean", defaultValue: false, writeRole: "owner", requiresApproval: true, storageRef: "branches.is_default_pickup", sortOrder: 300 }),
  define({ key: "branches.is_active", module: "branches", section: "business", label: "Branch active", scope: "branch", valueType: "boolean", defaultValue: true, writeRole: "owner", requiresApproval: true, storageRef: "branches.is_active", sortOrder: 310 }),

  define({ key: "crm.rx_reminder_enabled", module: "crm", section: "loyalty", label: "Rx reminders enabled", scope: "org", valueType: "boolean", defaultValue: false, writeRole: "admin", storageRef: "crm_settings.rx_reminder_enabled", sortOrder: 320 }),
  define({ key: "crm.rx_reminder_days_before", module: "crm", section: "loyalty", label: "Rx reminder lead days", scope: "org", valueType: "number", defaultValue: 30, writeRole: "admin", storageRef: "crm_settings.rx_reminder_days_before", sortOrder: 330 }),
  define({ key: "crm.birthday_enabled", module: "crm", section: "loyalty", label: "Birthday greetings enabled", scope: "org", valueType: "boolean", defaultValue: false, writeRole: "admin", storageRef: "crm_settings.birthday_enabled", sortOrder: 340 }),
  define({ key: "crm.birthday_coupon_pct", module: "crm", section: "loyalty", label: "Birthday coupon %", scope: "org", valueType: "number", defaultValue: 10, writeRole: "admin", storageRef: "crm_settings.birthday_coupon_pct", sortOrder: 350 }),
  define({ key: "crm.order_updates_enabled", module: "crm", section: "loyalty", label: "Order update messages", scope: "org", valueType: "boolean", defaultValue: true, writeRole: "admin", storageRef: "crm_settings.order_updates_enabled", sortOrder: 360 }),
  define({ key: "crm.cart_recovery_enabled", module: "crm", section: "loyalty", label: "Cart recovery enabled", scope: "org", valueType: "boolean", defaultValue: false, writeRole: "admin", storageRef: "crm_settings.cart_recovery_enabled", sortOrder: 370 }),
  define({ key: "crm.cart_recovery_hours", module: "crm", section: "loyalty", label: "Cart recovery delay hours", scope: "org", valueType: "number", defaultValue: 4, writeRole: "admin", storageRef: "crm_settings.cart_recovery_hours", sortOrder: 380 }),
  define({ key: "crm.wa_provider", module: "crm", section: "loyalty", label: "WhatsApp provider", scope: "org", valueType: "string", defaultValue: "wa.me", writeRole: "admin", storageRef: "crm_settings.wa_provider", sortOrder: 390 }),
  define({ key: "loyalty.earn_rate", module: "loyalty", section: "loyalty", label: "Loyalty earn rate", scope: "org", valueType: "number", defaultValue: 10, writeRole: "admin", affectsTransactions: true, snapshotPolicy: "order", storageRef: "loyalty_rules.earn_rate", sortOrder: 400 }),

  define({ key: "integrations.razorpay_key_id", module: "integrations", section: "integrations", label: "Razorpay key ID", scope: "org", valueType: "secret", defaultValue: "", isSecret: true, writeRole: "owner", requiresApproval: true, sortOrder: 410 }),
  define({ key: "integrations.razorpay_key_secret", module: "integrations", section: "integrations", label: "Razorpay key secret", scope: "org", valueType: "secret", defaultValue: "", isSecret: true, writeRole: "owner", requiresApproval: true, sortOrder: 420 }),
  define({ key: "integrations.razorpay_webhook_secret", module: "integrations", section: "integrations", label: "Razorpay webhook secret", scope: "org", valueType: "secret", defaultValue: "", isSecret: true, writeRole: "owner", requiresApproval: true, sortOrder: 430 }),
  define({ key: "integrations.ocr_service_token", module: "integrations", section: "integrations", label: "OCR service token", scope: "org", valueType: "secret", defaultValue: "", isSecret: true, writeRole: "owner", requiresApproval: true, sortOrder: 440 }),

  ...MODULE_REGISTRY.map((module, index) =>
    define({
      key: moduleSettingKey(module.key),
      module: "modules",
      section: "modules",
      label: `Enable ${module.label}`,
      scope: "org",
      valueType: "boolean",
      defaultValue: true,
      writeRole: "owner",
      requiresApproval: true,
      sortOrder: 500 + index,
    }),
  ),
];

export function defaultSettingValue(key: string): unknown {
  return BUILTIN_SETTING_DEFINITIONS.find((definition) => definition.key === key)?.defaultValue;
}
