import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type DocType = "sale" | "rx" | "repair" | "lab" | "credit_note" | "receipt" | "appointment";
const H = 3600_000;
// path = existing /print/<path>/[id] design that is reused for the document.
export const DOCS: Record<DocType, { table: string; select: string; path: string; label: string; ttl: number; maxViews: number | null }> = {
  sale:        { table: "sales",         select: "id, org_id, customer_id", path: "sale",        label: "Invoice / order",  ttl: 30 * 24 * H, maxViews: null },
  receipt:     { table: "payments",      select: "id, org_id, sales(customer_id)", path: "receipt", label: "Payment receipt", ttl: 30 * 24 * H, maxViews: null },
  rx:          { table: "prescriptions", select: "id, org_id, customer_id", path: "rx",          label: "Prescription",     ttl: 48 * H,      maxViews: 20 },
  repair:      { table: "repairs",       select: "id, org_id, customer_id", path: "repair",      label: "Repair card",      ttl: 30 * 24 * H, maxViews: null },
  lab:         { table: "lab_orders",    select: "id, org_id, customer_id", path: "lab",         label: "Job card",         ttl: 7 * 24 * H,  maxViews: null },
  credit_note: { table: "credit_notes",  select: "id, org_id, customer_id", path: "credit-note", label: "Credit note",      ttl: 30 * 24 * H, maxViews: null },
  appointment: { table: "appointments",  select: "id, org_id, customer_id", path: "appointment", label: "Appointment slip", ttl: 14 * 24 * H, maxViews: null },
};

export const serviceClient = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
};

function secret() {
  const s = process.env.DOC_LINK_SECRET;
  if (!s || s.length < 32) throw new Error("DOC_LINK_SECRET (min 32 chars) is not set");
  return s;
}
const sig = (hex: string) => crypto.createHmac("sha256", secret()).update(hex).digest("base64url").slice(0, 22);
export const makeToken = (id: string) => { const hex = id.replace(/-/g, ""); return `${hex}.${sig(hex)}`; };

export type LinkRow = { id: string; org_id: string; doc_type: DocType; ref_id: string; customer_id: string | null; expires_at: string; max_views: number | null; view_count: number; revoked_at: string | null; pdf_path: string | null; pdf_generated_at: string | null };
export type Verified = { ok: true; link: LinkRow } | { ok: false; reason: "invalid" | "expired" | "revoked" | "limit" };

// Token = <32 hex id>.<HMAC>; signature is checked before any DB lookup.
export async function verifyToken(token: string): Promise<Verified> {
  const m = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{22})$/.exec(token ?? "");
  if (!m) return { ok: false, reason: "invalid" };
  const a = Buffer.from(sig(m[1])), b = Buffer.from(m[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  const id = m[1].replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const { data: l } = await serviceClient().from("document_links").select("*").eq("id", id).maybeSingle();
  if (!l) return { ok: false, reason: "invalid" };
  if (l.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(l.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (l.max_views != null && l.view_count >= l.max_views) return { ok: false, reason: "limit" };
  return { ok: true, link: l as LinkRow };
}

// Used by the existing /print/* pages: staff session by default, or a verified
// customer link (?dt=) scoped to exactly this document type + record.
export async function printSb(type: DocType, id: string, dt?: string) {
  if (!dt) return supabaseServer();
  const v = await verifyToken(dt).catch(() => null);
  if (!v || !v.ok || v.link.doc_type !== type || v.link.ref_id !== id) notFound();
  return serviceClient();
}

export function linkBase(h: Headers) {
  if (process.env.NEXT_PUBLIC_ERP_URL) return process.env.NEXT_PUBLIC_ERP_URL.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}
