import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const SITE_SESSION_COOKIE = "poweros_site_session";

export type SiteSession = {
  user: { id: string; email: string; fullName?: string };
  organisations: any[];
  primaryOrganisationId: string | null;
  requiresOnboarding: boolean;
};

/** Verifies the httpOnly cookie and loads the user's organisation memberships. */
export async function getSiteSession(): Promise<SiteSession | null> {
  const token = cookies().get(SITE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await createClient().auth.getUser(token);
  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("organization_members")
    .select("org_id, role, organizations(*)")
    .eq("user_id", data.user.id);

  const memberships: any[] = (members as any) || [];
  const primary: any = memberships[0]?.organizations || null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email || "",
      fullName: data.user.user_metadata?.full_name,
    },
    organisations: memberships.map((m: any) => m.organizations),
    primaryOrganisationId: primary?.id || null,
    requiresOnboarding: memberships.length === 0 || !primary?.onboarding_completed_at,
  };
}
