"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeMapEmbed } from "@/lib/branch-map";

type R = { error?: string; ok?: string };

// Owner/admin gate shared by every settings mutation.
async function adminCtx(): Promise<R & { sb?: any; orgId?: string }> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role_key, org_id").eq("id", user.id).single();
  if (!["owner", "admin"].includes(profile?.role_key ?? "")) return { error: "Only owners and admins can change settings." };
  if (!profile?.org_id) return { error: "No organisation linked to your account." };
  return { sb, orgId: profile.org_id };
}

// Upsert key/value rows — org_settings PK is (org_id, key).
async function putKeys(sb: any, orgId: string, entries: Array<[string, any]>): Promise<string | null> {
  const rows = entries.map(([key, value]) => ({ org_id: orgId, key, value }));
  const { error } = await sb.from("org_settings").upsert(rows, { onConflict: "org_id,key" });
  return error ? error.message : null;
}

export async function saveSettings(data: Partial<{
  gst: boolean; gstin: string; maxDiscount: number; quoteDays: number; labDays: number; invoiceFooter: string;
}>): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const entries: Array<[string, any]> = [];
  if (data.gst !== undefined) entries.push(["gst_enabled", !!data.gst]);
  if (data.gstin !== undefined) entries.push(["gstin", (data.gstin ?? "").trim().toUpperCase() || null]);
  if (data.maxDiscount !== undefined) entries.push(["max_staff_discount_pct", Math.min(100, Math.max(0, Number(data.maxDiscount) || 0))]);
  if (data.quoteDays !== undefined) entries.push(["quotation_valid_days", Math.max(1, Number(data.quoteDays) || 7)]);
  if (data.labDays !== undefined) entries.push(["lab_lead_days", Math.max(1, Number(data.labDays) || 5)]);
  if (data.invoiceFooter !== undefined) entries.push(["invoice_footer", data.invoiceFooter.trim() || null]);
  if (!entries.length) return { error: "Nothing to save." };
  const err = await putKeys(a.sb, a.orgId!, entries);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Settings saved successfully." };
}

export async function saveOrgName(name: string): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const clean = (name ?? "").trim();
  if (!clean) return { error: "Organisation name cannot be empty." };
  const { error } = await a.sb.from("organizations").update({ name: clean }).eq("id", a.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: "Business name updated." };
}

export async function saveBranch(data: {
  id: string; name: string; address: string; phone: string; email?: string | null; udyam_no?: string | null;
  image_path?: string | null; map?: string;
}): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  // Normalise + validate whatever was pasted (embed HTML / Maps link / address)
  // down to a safe https://*.google.com/maps… URL — raw HTML is never stored.
  const map = normalizeMapEmbed(data.map ?? "");
  if (map.error) return { error: map.error };
  const { error } = await a.sb.from("branches").update({
    name: data.name.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || null,
    udyam_no: data.udyam_no?.trim() || null,
    image_path: data.image_path?.trim() || null,
    map_embed: map.url || null,
  }).eq("id", data.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: "Branch updated." };
}

export async function addBranch(data: {
  name: string; address: string; phone: string; email?: string; udyam_no?: string;
  image_path?: string | null; map?: string;
}): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  if (!data.name.trim()) return { error: "Branch name is required." };
  const map = normalizeMapEmbed(data.map ?? "");
  if (map.error) return { error: map.error };
  const { error } = await a.sb.from("branches").insert({
    org_id: a.orgId,
    name: data.name.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || null,
    udyam_no: data.udyam_no?.trim() || null,
    image_path: data.image_path?.trim() || null,
    map_embed: map.url || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: "Branch added." };
}

export async function saveLoyalty(data: {
  earnRate: number; redeemRate: number; minRedeem: number; maxRedeemPct: number;
}): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const row = {
    org_id: a.orgId,
    earn_rate: Math.max(0, Number(data.earnRate) || 0),
    redeem_rate: Math.max(1, Number(data.redeemRate) || 100),
    min_redeem: Math.max(0, Number(data.minRedeem) || 0),
    max_redeem_pct: Math.min(100, Math.max(0, Number(data.maxRedeemPct) || 0)),
  };
  const { data: existing } = await a.sb.from("loyalty_rules").select("id").eq("org_id", a.orgId).maybeSingle();
  const { error } = existing
    ? await a.sb.from("loyalty_rules").update(row).eq("id", existing.id)
    : await a.sb.from("loyalty_rules").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: "Loyalty rules saved." };
}

export async function saveWebsiteContact(data: { whatsappNumber: string; instagram: string }): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const wa = (data.whatsappNumber ?? "").replace(/\D/g, "");
  if (wa && wa.length < 10) return { error: "Enter a valid WhatsApp number (with country code, e.g. 919840496404)." };
  const err = await putKeys(a.sb, a.orgId!, [
    ["whatsapp_number", wa || null],
    ["instagram", (data.instagram ?? "").trim() || null],
  ]);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Website contact details saved." };
}

export async function saveAnalytics(analyticsId: string): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  const err = await putKeys(a.sb, a.orgId!, [["analytics_id", (analyticsId ?? "").trim() || null]]);
  if (err) return { error: err };
  revalidatePath("/settings");
  return { ok: "Analytics ID saved." };
}

export async function saveTemplate(data: {
  id: string; name: string; bodyAuto: string; bodyStaff: string; isActive: boolean; metaTemplate?: string;
}): Promise<R> {
  const a = await adminCtx();
  if (a.error || !a.sb) return { error: a.error };
  if (!data.bodyStaff.trim() || !data.bodyAuto.trim()) return { error: "Both message versions need a body." };
  const { error } = await a.sb.from("message_templates").update({
    name: data.name.trim() || "Untitled template",
    body_auto: data.bodyAuto,
    body_staff: data.bodyStaff,
    is_active: !!data.isActive,
    // Approved Meta API template name — read by the CRM edge functions on send
    meta_template: data.metaTemplate?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", data.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: "Template saved." };
}

export async function savePrefixes(prefixes: Record<string, string>): Promise<R> {
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
