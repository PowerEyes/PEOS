import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const PLATFORM_SESSION_COOKIE = "poweros_platform_session";

export type PlatformSession = {
  user: { id: string; email?: string };
  platformUser: Record<string, any>;
  role: string;
  name: string;
};

/**
 * Verifies the httpOnly session cookie against Supabase Auth and the
 * platform_users table. Every control-plane page calls this via the layout.
 */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const token = cookies().get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await createClient().auth.getUser(token);
  if (error || !data.user) return null;

  const admin = createAdminClient();
  const { data: platformUser } = await admin
    .from("platform_users")
    .select("*")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!platformUser) return null;

  return {
    user: { id: data.user.id, email: data.user.email },
    platformUser,
    role: platformUser.role || platformUser.platform_role || "read_only",
    name: platformUser.full_name || data.user.email || "Platform user",
  };
}
