"use server";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { DOCS, linkBase, makeToken, type DocType } from "@/lib/doclinks";

type Res = { ok: true; url: string; linkId: string; label: string; expiresAt: string; lastSentAt: string | null; sendCount: number } | { ok: false; error: string };

// Staff session + RLS decide access: if this user cannot read the record, no link is created.
export async function getDocLink(type: DocType, refId: string): Promise<Res> {
  try {
    const cfg = DOCS[type];
    if (!cfg || !/^[0-9a-f-]{36}$/i.test(refId)) return { ok: false, error: "Invalid document" };
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again" };
    const { data: rec } = await sb.from(cfg.table).select(cfg.select).eq("id", refId).maybeSingle();
    if (!rec) return { ok: false, error: "Document not found or you do not have access" };
    const r: any = rec;
    const customerId: string | null = r.customer_id ?? r.sales?.customer_id ?? null;

    // Duplicate-send guard: reuse the active link while it has >1h left.
    const { data: ex } = await sb.from("document_links").select("*").eq("doc_type", type).eq("ref_id", refId)
      .is("revoked_at", null).gt("expires_at", new Date(Date.now() + 3600_000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let link = ex;
    if (!link) {
      const { data: ins, error } = await sb.from("document_links").insert({
        org_id: r.org_id, doc_type: type, ref_id: refId, customer_id: customerId,
        expires_at: new Date(Date.now() + cfg.ttl).toISOString(), max_views: cfg.maxViews,
      }).select("*").single();
      if (error || !ins) return { ok: false, error: "Could not create the document link. Try again." };
      link = ins;
    }
    return { ok: true, url: `${linkBase(headers())}/d/${makeToken(link.id)}`, linkId: link.id, label: cfg.label,
      expiresAt: link.expires_at, lastSentAt: link.last_sent_at, sendCount: link.send_count };
  } catch (e: any) {
    console.error("[getDocLink]", e?.message);
    return { ok: false, error: e?.message?.includes("DOC_LINK_SECRET") ? "Document links are not configured (DOC_LINK_SECRET)" : "Document link failed. Try again." };
  }
}

// Called when staff open WhatsApp: updates counters (audited by trigger) and writes ERP communication history.
export async function logDocSend(linkId: string, template: string, phone: string) {
  try {
    const sb = supabaseServer();
    const { data: l } = await sb.from("document_links").select("*").eq("id", linkId).maybeSingle();
    if (!l) return { ok: false };
    await sb.from("document_links").update({ send_count: l.send_count + 1, last_sent_at: new Date().toISOString() }).eq("id", linkId);
    await sb.from("whatsapp_log").insert({
      org_id: l.org_id, customer_id: l.customer_id, phone: phone.replace(/\D/g, "").slice(-10),
      template: template || "custom", category: "document", status: "sent",
      metadata: { channel: "wa_web", link_id: linkId, doc_type: l.doc_type, ref_id: l.ref_id },
    });
    return { ok: true };
  } catch { return { ok: false }; }
}

export async function revokeDocLink(linkId: string) {
  const { error } = await supabaseServer().from("document_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  return error ? { error: "Could not revoke link" } : { ok: true };
}
