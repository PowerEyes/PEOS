import { tenant } from "./tenant.ts";

// WhatsApp template name constants
// These must match the approved template names in your Meta Business Manager / Interakt account

export const TEMPLATES = {
  // Category: UTILITY (transactional)
  ORDER_CONFIRMED:  "power_eyes_order_confirmed",   // params: [name, order_code]
  ORDER_READY:      "power_eyes_order_ready",        // params: [name, order_code, store_name]
  ORDER_DELIVERED:  "power_eyes_order_delivered",   // params: [name, order_code]
  ORDER_CANCELLED:  "power_eyes_order_cancelled",   // params: [name, order_code, reason]

  // Category: UTILITY
  RX_EXPIRY:        "power_eyes_rx_expiry",          // params: [name, days_left, expiry_date, booking_link]
  EYE_TEST_CONFIRM: "power_eyes_appt_confirmed",    // params: [name, date, time, store_name]

  // Category: MARKETING (requires opt-in)
  BIRTHDAY:         "power_eyes_birthday_offer",    // params: [name, coupon_code, expiry_date]
  CART_RECOVERY:    "power_eyes_cart_recovery",     // params: [name, item_name, cart_link]
  REORDER_REMINDER: "power_eyes_reorder_reminder",  // params: [name, product_name, months_since]
} as const;

// Template preview text (for ERP CRM dashboard display)
export const TEMPLATE_PREVIEW: Record<string, string> = {
  [TEMPLATES.ORDER_CONFIRMED]:  "Hi {name}! Your order #{order_code} has been placed. We'll notify you when it's ready.",
  [TEMPLATES.ORDER_READY]:      "Hi {name}! Great news — your order #{order_code} is ready for pickup at our {store} store. See you soon!",
  [TEMPLATES.ORDER_DELIVERED]:  "Hi {name}! Your order #{order_code} has been delivered. We hope you love your new eyewear! 👓",
  [TEMPLATES.ORDER_CANCELLED]:  "Hi {name}! Your order #{order_code} has been cancelled. {reason} For help, call 9840496404.",
  [TEMPLATES.RX_EXPIRY]:        "Hi {name}! Your Power Eyes prescription expires in {days_left} days (on {expiry_date}). Book your eye test: {link}",
  [TEMPLATES.BIRTHDAY]:         "Happy Birthday {name}! 🎂 Celebrate with {pct}% off your next purchase. Use code {coupon} (valid 7 days).",
  [TEMPLATES.CART_RECOVERY]:    "Hi {name}! You left {item} in your bag. Complete your order: {link}",
  [TEMPLATES.EYE_TEST_CONFIRM]: "Hi {name}! Your eye test at Power Eyes is confirmed for {date} at {time} ({store}). See you then!",
};

// ── DB-driven template names (Settings → WhatsApp message templates) ─────────
// Automation key (message_templates.key) → approved Meta template name.
// Used as the fallback when the table / row is unavailable (e.g. before
// migration 0026 has been applied), so behaviour is unchanged either way.
export const DB_FALLBACK: Record<string, string> = {
  order_confirmed:       TEMPLATES.ORDER_CONFIRMED,
  order_ready:           TEMPLATES.ORDER_READY,
  order_delivered:       TEMPLATES.ORDER_DELIVERED,
  order_cancelled:       TEMPLATES.ORDER_CANCELLED,
  rx_expiry:             TEMPLATES.RX_EXPIRY,
  birthday:              TEMPLATES.BIRTHDAY,
  cart_recovery:         TEMPLATES.CART_RECOVERY,
  appointment_confirmed: TEMPLATES.EYE_TEST_CONFIRM,
  reorder_reminder:      TEMPLATES.REORDER_REMINDER,
};

// Resolve the Meta template name for an automation key from the DB, so edits
// in Settings take effect without redeploying the function. Param assembly
// stays in the function code (Meta's approved param order). Falls back to the
// constant above whenever the DB can't answer.
export async function resolveTemplateName(sb: any, key: string): Promise<string> {
  try {
    const { data, error } = await sb
      .from("message_templates")
      .select("meta_template")
      .eq("org_id", tenant.org)
      .eq("key", key)
      .maybeSingle();
    if (!error) {
      const name = typeof data?.meta_template === "string" ? data.meta_template.trim() : "";
      if (name) return name;
    }
  } catch { /* table not migrated yet → constant fallback */ }
  return DB_FALLBACK[key] ?? key;
}
