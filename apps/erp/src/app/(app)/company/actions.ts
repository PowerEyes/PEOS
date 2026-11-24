"use server";
import { revalidatePath } from "next/cache";
import { subscriptionGate } from "@/lib/entitlements";
import {
  normalizeBranding,
  normalizeDocuments,
  normalizePolicies,
} from "@/lib/company-profile";
import { adminCtx, putKeys } from "../settings-actions";

type R = { error?: string; ok?: string };

// Company profile mutations (plan §6 /company/*). All three share the settings
// admin gate + subscription write gate, normalise through src/lib/company-profile
// and land in org_settings, whose RLS (is_admin) and audit trigger back them up.

export async function saveCompanyDocuments(data: unknown): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const docs = normalizeDocuments(data);
  if (!docs) return { error: "Those documents are invalid — check titles and dates (YYYY-MM-DD)." };
  const err = await putKeys(a.sb, a.orgId!, [["company_documents", docs]]);
  if (err) return { error: err };
  revalidatePath("/company/docs");
  revalidatePath("/company");
  return { ok: `Saved ${docs.length} document${docs.length === 1 ? "" : "s"}.` };
}

export async function saveBranding(data: unknown): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const b = normalizeBranding(data);
  if (!b) return { error: "Enter a logo URL (https://… or /…) and 6-digit hex colours like #0A2240." };
  const err = await putKeys(a.sb, a.orgId!, [
    ["brand_logo_url", b.logo_url],
    ["brand_primary", b.primary],
    ["brand_accent", b.accent],
  ]);
  if (err) return { error: err };
  revalidatePath("/company/branding");
  revalidatePath("/company");
  return { ok: "Branding saved." };
}

export async function savePolicies(data: unknown): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const p = normalizePolicies(data);
  if (!p) return { error: "Policy texts are too long — keep each under 4,000 characters." };
  const err = await putKeys(a.sb, a.orgId!, [
    ["policy_returns", p.returns],
    ["policy_warranty", p.warranty],
    ["policy_privacy", p.privacy],
  ]);
  if (err) return { error: err };
  revalidatePath("/company/policies");
  revalidatePath("/company");
  return { ok: "Policies saved." };
}
