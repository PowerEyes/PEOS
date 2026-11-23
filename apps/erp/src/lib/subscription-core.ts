// Pure, dependency-free subscription/entitlement logic — shared by server actions,
// pages and unit tests. The database function public.resolve_entitlements(org_id)
// is the single source of truth for the JSON shape; this module only interprets it.
export type EntitlementLimits = Record<string, number | null>;
export type EntitlementFeatures = Record<string, unknown>;

export type Entitlements = {
  status: string;
  plan_code?: string;
  plan_name?: string;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  current_period_end?: string | null;
  features: EntitlementFeatures;
  limits: EntitlementLimits;
};

/** Statuses that grant full operational access. */
export const LIVE_STATUSES = ["trialing", "active", "grace", "payment_pending", "payment_failed", "past_due"] as const;
/** Statuses that block writes but keep reads/billing/export/support. */
export const RESTRICTED_STATUSES = ["expired", "suspended", "cancelled", "none", "inactive"] as const;

export function isLive(e: Entitlements | null | undefined): boolean {
  return !!e && (LIVE_STATUSES as readonly string[]).includes(e.status);
}

export function writesBlocked(e: Entitlements | null | undefined): boolean {
  if (!e) return true;
  if (e.features?.["_writes_blocked"]) return true;
  return !(LIVE_STATUSES as readonly string[]).includes(e.status);
}

/**
 * Enforcement rollout mode (plan 9.5): 'enforce' refuses a blocked write,
 * 'log' records it and lets the write through. Anything unreadable or unknown
 * falls back to log-only, matching the database default, so the knob can never
 * fail closed and lock a customer out during the rollout.
 */
export function isEnforcementActive(mode: string | null | undefined): boolean {
  return mode === "enforce";
}

/**
 * The whole write-guard decision, pure so it is unit-tested. Returns the
 * user-facing refusal message, or null when the write should proceed.
 * A blocked subscription therefore still proceeds in log-only mode — the
 * caller records the violation instead of returning this message.
 */
export function subscriptionWriteBlock(
  e: Entitlements | null | undefined,
  mode: string | null | undefined,
): string | null {
  if (!writesBlocked(e)) return null;
  if (!isEnforcementActive(mode)) return null;
  return "Your subscription is not active. Renew or upgrade to continue making changes.";
}

export function hasFeature(e: Entitlements | null | undefined, key: string): boolean {
  if (!e) return false;
  const v = e.features?.[key];
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v !== "" && v.toLowerCase() !== "false";
  return true;
}

/** Feature is granted at a minimum tier: true >= "basic" >= "advanced" >= "limited". */
const TIER_ORDER: Record<string, number> = { basic: 1, limited: 1, advanced: 2, true: 3, false: 0 };
export function hasFeatureTier(e: Entitlements | null | undefined, key: string, min: "basic" | "advanced" | "true"): boolean {
  if (!e) return false;
  const v = e.features?.[key];
  const rank = TIER_ORDER[String(v)] ?? (v === true ? 3 : 0);
  const need = TIER_ORDER[min];
  return rank >= need;
}

export function limitOf(e: Entitlements | null | undefined, key: string): number | null {
  if (!e) return null;
  const v = e.limits?.[key];
  return typeof v === "number" ? v : null;
}

/** null limit = unlimited; returns true when the org may create one more of `key`. */
export function withinLimit(e: Entitlements | null | undefined, key: string, current: number): boolean {
  if (!e) return false; // no entitlements = no plan = deny
  const max = limitOf(e, key);
  if (max === null) return true;
  return current < max;
}

export class EntitlementError extends Error {
  feature: string;
  reason: string;
  constructor(feature: string, reason: string = "subscription") {
    super(`Entitlement required: ${feature}`);
    this.name = "EntitlementError";
    this.feature = feature;
    this.reason = reason;
  }
}

export function assertWritable(e: Entitlements | null | undefined) {
  if (writesBlocked(e)) throw new EntitlementError("_writes", "subscription_expired");
}

export function assertFeature(e: Entitlements | null | undefined, key: string) {
  if (!hasFeature(e, key)) throw new EntitlementError(key, "feature_not_in_plan");
}

export function assertLimit(e: Entitlements | null | undefined, key: string, current: number) {
  if (!withinLimit(e, key, current)) throw new EntitlementError(key, "limit_reached");
}

/** Map an EntitlementError to a user-facing message for server actions. */
export function entitlementMessage(err: unknown): string {
  if (err instanceof EntitlementError) {
    if (err.reason === "subscription_expired") return "Your subscription has expired. Renew or upgrade to continue writing data.";
    if (err.reason === "limit_reached") return `Plan limit reached for ${err.feature}. Upgrade your plan to continue.`;
    return `This feature (${err.feature}) is not included in your current plan. Upgrade to unlock it.`;
  }
  return "";
}

/**
 * Splits a GST-inclusive price into its taxable value and GST component.
 * `rateBp` is basis points (1800 = 18%), read from platform_settings so the
 * platform admin owns the rate rather than each tenant.
 *
 * The advertised plan price is what the customer pays on Razorpay, so the total
 * is never grossed up: taxable = total / (1 + rate) and GST is the remainder.
 * Rounding always lands back on the total, so taxable + tax === total exactly.
 */
export function splitGst(totalMinor: number, rateBp: number): { totalMinor: number; taxableMinor: number; taxMinor: number } {
  const total = Math.max(0, Math.round(totalMinor));
  const rate = Number.isFinite(rateBp) && rateBp > 0 ? rateBp : 0;
  if (rate === 0) return { totalMinor: total, taxableMinor: total, taxMinor: 0 };
  const taxable = Math.round((total * 10000) / (10000 + rate));
  return { totalMinor: total, taxableMinor: taxable, taxMinor: total - taxable };
}

/**
 * How a plan may be granted.
 *
 * The three cases must stay distinct: `unpriced` (price_minor IS NULL) means
 * "not sold online, contact sales" and must never be coerced to 0 — doing so
 * would hand out an Enterprise subscription for free.
 */
export type PlanGate = "free" | "unpriced" | "paid";

export function planGate(priceMinor: number | string | null | undefined): PlanGate {
  if (priceMinor == null || priceMinor === "") return "unpriced";
  const n = typeof priceMinor === "number" ? priceMinor : Number(priceMinor);
  // Negative or unparseable is a data problem, not a discount: refuse rather than
  // let a broken row grant a plan.
  if (!Number.isFinite(n) || n < 0) return "unpriced";
  return n > 0 ? "paid" : "free";
}
