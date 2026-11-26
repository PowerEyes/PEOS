import type { SupabaseClient } from "@supabase/supabase-js";

export type Announcement = {
  id: string; title: string; body: string;
  target: string; published_at: string; expires_at: string | null;
};

/** The company's current subscription status, used to pick which announcements
 *  reach it. No subscription yet → "none" (only target=all matches). */
export async function getSubscriptionStatus(sb: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await sb
    .from("org_subscriptions")
    .select("status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.status ?? "none";
}

/** Announcements this company should see: platform-wide ones plus those aimed
 *  at our subscription status (all | trialing | past_due | expired), that are
 *  published and not yet expired. */
export async function getAnnouncements(sb: SupabaseClient, status: string): Promise<Announcement[]> {
  const now = new Date().toISOString();
  const { data } = await sb
    .from("announcements")
    .select("id, title, body, target, published_at, expires_at")
    .or(`target=all,target=eq.${status}`)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .lte("published_at", now)
    .order("published_at", { ascending: false })
    .limit(5);
  return (data ?? []) as Announcement[];
}
