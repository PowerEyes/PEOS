// Server-side entitlements helper for PowerOS SaaS.
// Single source of truth: public.resolve_entitlements(org_id) (DB), interpreted by
// lib/subscription-core.ts (pure, unit-tested). This file only does the I/O.
import { supabaseServer } from "./supabase/server";
import { writesBlocked, subscriptionWriteBlock, type Entitlements } from "./subscription-core";

export type { Entitlements } from "./subscription-core";
export {
  hasFeature, hasFeatureTier, writesBlocked, isLive, limitOf, withinLimit,
  isEnforcementActive, subscriptionWriteBlock, EntitlementError, assertWritable, assertFeature, assertLimit, entitlementMessage,
} from "./subscription-core";

export async function getEntitlements(orgId?: string): Promise<Entitlements | null> {
  const sb = supabaseServer();
  let org = orgId;
  if (!org) {
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb.from("profiles").select("org_id").eq("id", user?.id ?? "").maybeSingle();
    org = data?.org_id as string | undefined;
  }
  if (!org) return null;
  const { data, error } = await sb.rpc("resolve_entitlements", { p_org: org });
  if (error || !data) return null;
  return data as Entitlements;
}

/**
 * Reads the enforcement rollout knob (plan 9.5) straight from the database so
 * the app and the DB triggers can never disagree about the current mode.
 * Unreadable -> log-only, matching the database default.
 */
export async function getEnforcementMode(): Promise<string> {
  const sb = supabaseServer();
  const { data, error } = await sb.rpc("entitlement_enforcement");
  if (error || typeof data !== "string") return "log";
  return data;
}

/**
 * Guard for server actions that write business data. Returns a user-facing error
 * message when the subscription is expired/suspended/cancelled, else null.
 * Progressive: apply to new write paths; the DB triggers already enforce plan limits.
 *
 * During the rollout (plan 9.5) the guard runs in log-only mode: the blocked
 * write is logged and allowed, so a bad entitlement calculation cannot stop a
 * customer from working. Flip the mode from /platform to start enforcing.
 */
export async function assertSubscriptionWritable(): Promise<string | null> {
  const e = await getEntitlements();
  if (!writesBlocked(e)) return null; // fast path: nothing to decide
  const blocked = subscriptionWriteBlock(e, await getEnforcementMode());
  if (!blocked) {
    console.warn(`[entitlements] log-only: write allowed despite blocked subscription (status=${e?.status ?? "unknown"})`);
  }
  return blocked;
}

/**
 * The one-liner every mutating server action opens with:
 *
 *   const gate = await subscriptionGate(); if (gate) return gate;
 *
 * Returns `{ error }` when the subscription refuses writes, else null, so it
 * drops straight into the existing `{ error?, ok? }` action result shape.
 * Reads, billing and support paths must NOT call this — they stay reachable
 * when a subscription is expired or suspended.
 */
export async function subscriptionGate(): Promise<{ error: string } | null> {
  const blocked = await assertSubscriptionWritable();
  return blocked ? { error: blocked } : null;
}
