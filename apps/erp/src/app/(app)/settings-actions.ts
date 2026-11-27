"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeMapEmbed } from "@/lib/branch-map";
import { assertSubscriptionWritable, subscriptionGate } from "@/lib/entitlements";
import { z } from "zod";

type R = { error?: string; ok?: string };

// Owner/admin gate shared by every settings mutation (also used by /company/*).
export async function adminCtx(): Promise<R & { sb?: any; orgId?: string }> {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("role_key, org_id")
    .eq("id", user.id)
    .single();
  if (!["owner", "admin"].includes(profile?.role_key ?? ""))
    return { error: "Only owners and admins can change settings." };
  if (!profile?.org_id)
    return { error: "No organisation linked to your account." };
  return { sb, orgId: profile.org_id };
}

// Upsert key/value rows — org_settings PK is (org_id, key). Exported for the
// /company/* actions; callers pass an explicit allow-list of keys.
export async function putKeys(
  sb: any,
  orgId: string,
  entries: Array<[string, any]>,
): Promise<string | null> {
  const rows = entries.map(([key, value]) => ({ org_id: orgId, key, value }));
  const { error } = await sb
    .from("org_settings")
    .upsert(rows, { onConflict: "org_id,key" });
  return error ? dbError(error.message) : null;
}

export async function saveSettings(
  data: Partial<{
    gst: boolean;
    gstin: string;
    maxDiscount: number;
    quoteDays: number;
    labDays: number;
    invoiceFooter: string;
    defaultSupplyType: "intrastate" | "interstate";
    defaultStateOfSupply: string;
  }>,
): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const entries: Array<[string, any]> = [];
  if (data.gst !== undefined) entries.push(["gst_enabled", !!data.gst]);
  if (data.gstin !== undefined) {
    const gstin = (data.gstin ?? "").trim().toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))
      return { error: "Enter a valid 15-character GSTIN." };
    entries.push(["gstin", gstin]);
  }
  if (data.maxDiscount !== undefined) {
    const value = Number(data.maxDiscount);
    entries.push([
      "max_staff_discount_pct",
      Math.min(100, Math.max(0, Number.isFinite(value) ? value : 10)),
    ]);
  }
  if (data.quoteDays !== undefined) {
    const value = Number(data.quoteDays);
    entries.push([
      "quotation_valid_days",
      Math.max(1, Number.isFinite(value) ? value : 14),
    ]);
  }
  if (data.labDays !== undefined)
    entries.push(["lab_lead_days", Math.max(1, Number(data.labDays) || 5)]);
  if (data.invoiceFooter !== undefined)
    entries.push(["invoice_footer", data.invoiceFooter.trim()]);
  if (data.defaultSupplyType !== undefined) {
    if (!["intrastate", "interstate"].includes(data.defaultSupplyType))
      return { error: "Choose a valid default supply type." };
    entries.push(["default_supply_type", data.defaultSupplyType]);
  }
  if (data.defaultStateOfSupply !== undefined) {
    const state = data.defaultStateOfSupply.trim();
    if (!state || state.length > 80)
      return { error: "Enter a valid state or union territory." };
    entries.push(["default_state_of_supply", state]);
  }
  if (!entries.length) return { error: "Nothing to save." };
  const err = await putKeys(a.sb, a.orgId!, entries);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Settings saved successfully." };
}

export async function saveBusinessProfile(data: {
  legal_name: string;
  business_email: string;
  business_phone: string;
  billing_address: string;
  timezone: string;
  financial_year_start_month: number;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const p = z
    .object({
      legal_name: z.string().trim().max(160),
      business_email: z.union([
        z.literal(""),
        z.string().trim().email().max(254),
      ]),
      business_phone: z.string().trim().max(30),
      billing_address: z.string().trim().max(500),
      timezone: z.string().trim().min(1).max(64),
      financial_year_start_month: z.number().int().min(1).max(12),
    })
    .safeParse(data);
  if (!p.success)
    return { error: p.error.issues[0]?.message ?? "Invalid business profile." };
  try {
    new Intl.DateTimeFormat("en", { timeZone: p.data.timezone });
  } catch {
    return { error: "Enter a valid IANA timezone, such as Asia/Kolkata." };
  }
  const { error } = await a.sb
    .from("organizations")
    .update({ ...p.data, business_email: p.data.business_email || null })
    .eq("id", a.orgId);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/print");
  revalidatePath("/finance");
  return { ok: "Business profile saved." };
}

export async function saveOrgName(name: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const clean = (name ?? "").trim();
  if (!clean) return { error: "Organisation name cannot be empty." };
  const { error } = await a.sb
    .from("organizations")
    .update({ name: clean })
    .eq("id", a.orgId);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return { ok: "Business name updated." };
}

export async function saveBranch(data: {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string | null;
  udyam_no?: string | null;
  image_path?: string | null;
  image_alt?: string | null;
  map?: string;
  legal_name?: string | null;
  gstin?: string | null;
  timezone?: string;
  opening_hours?: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;
  invoice_terms?: string | null;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  // Normalise + validate whatever was pasted (embed HTML / Maps link / address)
  // down to a safe https://*.google.com/maps… URL — raw HTML is never stored.
  const map = normalizeMapEmbed(data.map ?? "");
  if (map.error) return { error: map.error };
  const gstin = (data.gstin ?? "").trim().toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))
    return { error: "Enter a valid 15-character branch GSTIN." };
  const hoursSchema = z.record(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    z.object({
      open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      closed: z.boolean(),
    }),
  );
  const hours = hoursSchema.safeParse(data.opening_hours ?? {});
  if (!hours.success)
    return { error: "Enter valid opening and closing times for each weekday." };
  const timezone = (data.timezone ?? "Asia/Kolkata").trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "Enter a valid IANA branch timezone." };
  }
  const { error } = await a.sb
    .from("branches")
    .update({
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      udyam_no: data.udyam_no?.trim() || null,
      image_path: data.image_path?.trim() || null,
      image_alt: data.image_alt?.trim() || null,
      legal_name: data.legal_name?.trim() || null,
      gstin: gstin || null,
      timezone,
      opening_hours: hours.data,
      invoice_terms: data.invoice_terms?.trim() || null,
      map_embed: map.url || null,
    })
    .eq("id", data.id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return { ok: "Branch updated." };
}

export async function addBranch(data: {
  code: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  udyam_no?: string;
  image_path?: string | null;
  image_alt?: string | null;
  map?: string;
  legal_name?: string | null;
  gstin?: string | null;
  timezone?: string;
  opening_hours?: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;
  invoice_terms?: string | null;
}): Promise<R> {
  const blocked = await assertSubscriptionWritable();
  if (blocked) return { error: blocked };
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  if (!data.name.trim()) return { error: "Branch name is required." };
  const code = data.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code))
    return {
      error:
        "Branch code must be 2–12 letters, numbers, dashes or underscores.",
    };
  const map = normalizeMapEmbed(data.map ?? "");
  if (map.error) return { error: map.error };
  const gstin = (data.gstin ?? "").trim().toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin))
    return { error: "Enter a valid 15-character branch GSTIN." };
  const hoursSchema = z.record(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    z.object({
      open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      closed: z.boolean(),
    }),
  );
  const hours = hoursSchema.safeParse(data.opening_hours ?? {});
  if (!hours.success)
    return { error: "Enter valid opening and closing times for each weekday." };
  const timezone = (data.timezone ?? "Asia/Kolkata").trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "Enter a valid IANA branch timezone." };
  }
  const { data: inserted, error } = await a.sb
    .from("branches")
    .insert({
      org_id: a.orgId,
      code,
      name: data.name.trim(),
      address: data.address.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      udyam_no: data.udyam_no?.trim() || null,
      image_path: data.image_path?.trim() || null,
      image_alt: data.image_alt?.trim() || null,
      legal_name: data.legal_name?.trim() || null,
      gstin: gstin || null,
      timezone,
      opening_hours: hours.data,
      invoice_terms: data.invoice_terms?.trim() || null,
      map_embed: map.url || null,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error.message) };
  const { data: hasDefault } = await a.sb
    .from("branches")
    .select("id")
    .eq("is_default_pickup", true)
    .maybeSingle();
  if (!hasDefault && inserted?.id) {
    const { error: e } = await a.sb.rpc("set_default_pickup_branch", {
      p_branch: inserted.id,
    });
    if (e) return { error: dbError(e.message) };
  }
  revalidatePath("/settings");
  return { ok: "Branch added." };
}

export async function setDefaultPickupBranch(id: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const { error } = await a.sb.rpc("set_default_pickup_branch", {
    p_branch: id,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/api/store-branches");
  return { ok: "Default pickup branch updated." };
}
export async function setBranchActive(id: string, active: boolean): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const { error } = await a.sb.rpc("set_branch_active", {
    p_branch: id,
    p_active: active,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  revalidatePath("/api/store-branches");
  return {
    ok: active
      ? "Branch reactivated."
      : "Branch deactivated. Existing records are retained.",
  };
}

export async function saveLoyalty(data: {
  earnRate: number;
  redeemRate: number;
  minRedeem: number;
  maxRedeemPct: number;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const row = {
    org_id: a.orgId,
    earn_rate: Math.max(0, Number(data.earnRate) || 0),
    redeem_rate: Math.max(1, Number(data.redeemRate) || 100),
    min_redeem: Math.max(0, Number(data.minRedeem) || 0),
    max_redeem_pct: Math.min(100, Math.max(0, Number(data.maxRedeemPct) || 0)),
  };
  const { data: existing } = await a.sb
    .from("loyalty_rules")
    .select("id")
    .eq("org_id", a.orgId)
    .maybeSingle();
  const { error } = existing
    ? await a.sb.from("loyalty_rules").update(row).eq("id", existing.id)
    : await a.sb.from("loyalty_rules").insert(row);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return { ok: "Loyalty rules saved." };
}

export async function saveWebsiteContact(data: {
  whatsappNumber: string;
  instagram: string;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const wa = (data.whatsappNumber ?? "").replace(/\D/g, "");
  if (wa && wa.length < 10)
    return {
      error:
        "Enter a valid WhatsApp number (with country code, e.g. 919840496404).",
    };
  const err = await putKeys(a.sb, a.orgId!, [
    ["whatsapp_number", wa],
    ["instagram", (data.instagram ?? "").trim()],
  ]);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Website contact details saved." };
}

export async function saveAnalytics(analyticsId: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const err = await putKeys(a.sb, a.orgId!, [
    ["analytics_id", (analyticsId ?? "").trim()],
  ]);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Analytics ID saved." };
}

export async function saveTemplate(data: {
  id: string;
  name: string;
  bodyAuto: string;
  bodyStaff: string;
  isActive: boolean;
  metaTemplate?: string;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  if (!data.bodyStaff.trim() || !data.bodyAuto.trim())
    return { error: "Both message versions need a body." };
  const { data: template } = await a.sb
    .from("message_templates")
    .select("variables")
    .eq("id", data.id)
    .maybeSingle();
  const known = new Set<string>(template?.variables ?? []);
  for (const body of [data.bodyAuto, data.bodyStaff])
    for (const [, token] of body.matchAll(/\[([^\]]+)\]/g))
      if (!known.has(token.trim()))
        return {
          error: `Unknown message token [${token}]. Use only the template's existing variables.`,
        };
  const { error } = await a.sb
    .from("message_templates")
    .update({
      name: data.name.trim() || "Untitled template",
      body_auto: data.bodyAuto,
      body_staff: data.bodyStaff,
      is_active: !!data.isActive,
      // Approved Meta API template name — read by the CRM edge functions on send
      meta_template: data.metaTemplate?.trim() || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return { ok: "Template saved." };
}

export async function createTemplate(data: {
  name: string;
  category: string;
  bodyAuto: string;
  bodyStaff: string;
  variables: string;
  metaTemplate?: string;
}): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const p = z
    .object({
      name: z.string().trim().min(2).max(100),
      category: z.enum([
        "onboarding",
        "order",
        "repair",
        "after_sales",
        "feedback",
        "relationship",
        "staff",
        "documents",
        "appointments",
        "sales",
        "finance",
        "automation",
        "general",
      ]),
      bodyAuto: z.string().trim().min(1).max(4000),
      bodyStaff: z.string().trim().min(1).max(8000),
      variables: z.string().max(1000),
      metaTemplate: z.string().trim().max(120).optional(),
    })
    .safeParse(data);
  if (!p.success)
    return { error: p.error.issues[0]?.message ?? "Invalid message template." };
  const variables = [
    ...new Set(
      p.data.variables
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  if (variables.some((x) => x.length > 50 || !/^[\w -]+$/.test(x)))
    return {
      error:
        "Variable names can use letters, numbers, spaces, underscores and hyphens.",
    };
  for (const body of [p.data.bodyAuto, p.data.bodyStaff])
    for (const [, token] of body.matchAll(/\[([^\]]+)\]/g))
      if (!variables.includes(token.trim()))
        return {
          error: `Declare [${token}] in the variables list before saving.`,
        };
  const slug =
    p.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "template";
  const { data: existing } = await a.sb
    .from("message_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await a.sb
    .from("message_templates")
    .insert({
      org_id: a.orgId,
      key: `${slug}_${crypto.randomUUID().slice(0, 8)}`,
      category: p.data.category,
      name: p.data.name,
      body_auto: p.data.bodyAuto,
      body_staff: p.data.bodyStaff,
      meta_template: p.data.metaTemplate?.trim() ?? "",
      variables,
      sort_order: (existing?.sort_order ?? 0) + 1,
      is_active: true,
    });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return { ok: "Message template created." };
}
export async function archiveTemplate(
  id: string,
  archived: boolean,
): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const { error } = await a.sb
    .from("message_templates")
    .update({ is_active: !archived, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/settings");
  return {
    ok: archived
      ? "Template archived and removed from active message choices."
      : "Template restored.",
  };
}

export async function savePrefixes(
  prefixes: Record<string, string>,
): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefixes ?? {})) {
    const key = k.trim();
    const val = (v ?? "").trim();
    if (key) clean[key] = val;
  }
  const err = await putKeys(a.sb, a.orgId!, [["code_prefixes", clean]]);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Code prefixes saved. New codes use them immediately." };
}
