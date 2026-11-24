"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/doclinks";

type R = { error?: string; ok?: string };

/**
 * Open a support ticket for the caller's company.
 *
 * Deliberately NOT wrapped in subscriptionGate(): plan §8 keeps
 * billing/export/support reachable for expired and suspended companies —
 * support is exactly who they need to reach when something is wrong.
 * The org boundary comes from RLS (support_tickets_tenant_insert checks
 * org_id = current_org()), never from client input.
 */
export async function createTicket(subject: string, body: string, priority: string): Promise<R> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const s = subject.trim();
  const b = body.trim();
  if (s.length < 5) return { error: "Give your subject at least a few words." };
  if (s.length > 200) return { error: "Subject is limited to 200 characters." };
  if (b.length > 4000) return { error: "Message is limited to 4000 characters." };
  const p = ["normal", "high", "urgent"].includes(priority) ? priority : "normal";

  // 10 tickets / hour / user. EXECUTE on rate_limit_hit was deliberately
  // revoked from tenants (20261123000000), so it is called with the service
  // client exactly like /api/ocr does. Fails open: support must never be the
  // thing that breaks when the service key is unconfigured.
  let allowed: boolean | null = null;
  try {
    const { data, error } = await serviceClient().rpc("rate_limit_hit", {
      p_key: `support_ticket:${user.id}`, p_limit: 10, p_window_secs: 3600 });
    allowed = error ? null : data;
  } catch { allowed = null; }
  if (allowed === false) return { error: "You have opened several tickets recently — please wait a little before sending another." };

  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile?.org_id) return { error: "Your account is not attached to a company yet." };

  const { error } = await sb.from("support_tickets").insert({
    org_id: profile.org_id, subject: s, body: b || null, priority: p, created_by: user.id });
  if (error) return { error: "Your message could not be sent. Please try again." };

  revalidatePath("/support");
  return { ok: "Ticket opened — the PowerOS team will get back to you by email." };
}
