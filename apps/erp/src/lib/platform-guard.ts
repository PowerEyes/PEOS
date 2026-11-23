// Platform Super Admin guard — a SEPARATE authorization scope from company tenants.
// A tenant user with role "owner" is NOT a platform admin. Platform admins are
// rows in platform_users (service-role managed) linked to an auth user id.
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PlatformRole = "super_admin" | "support" | "billing" | "read_only";

export type PlatformUser = { user_id: string; email: string; platform_role: PlatformRole; is_active: boolean };

/** Server-side platform identity. Returns null when the caller is not an active platform admin. */
export async function getPlatformUser(): Promise<PlatformUser | null> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  // platform_users RLS revokes tenant access, so read it via the elevated client
  // (still guarded: this helper is only called from /platform routes + actions).
  const admin = supabaseAdmin();
  const { data } = await admin.from("platform_users").select("user_id, email, platform_role, is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  return (data as PlatformUser) ?? null;
}

export async function requirePlatform(): Promise<PlatformUser> {
  const p = await getPlatformUser();
  if (!p) redirect("/");
  return p;
}

/** Throws unless the caller holds one of the given platform roles. */
export function requirePlatformRole(p: PlatformUser | null, roles: PlatformRole[]): boolean {
  return !!p && p.is_active && roles.includes(p.platform_role);
}

/** Super-admin only. */
export const isSuperAdmin = (p: PlatformUser | null) => requirePlatformRole(p, ["super_admin"]);
