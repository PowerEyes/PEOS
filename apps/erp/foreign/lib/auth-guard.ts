import { supabaseServer } from "@/lib/supabase/server";
import { dbError } from "@poweros/business-rules";

export type Role = "owner" | "admin" | "manager" | "staff" | "optometrist" | "cashier";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  optometrist: 40,
  cashier: 30,
  staff: 20,
};

export async function getCallerProfile(): Promise<{
  sb: ReturnType<typeof supabaseServer>;
  user: any;
  profile: { role_key: string; org_id: string; branch_id: string | null; is_approved: boolean; deactivated: boolean } | null;
  error?: string;
}> {
  const sb = supabaseServer();
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return { sb, user: null, profile: null, error: "Not authenticated" };
  const { data: profile, error: profileError } = await sb.from("profiles").select("role_key, org_id, branch_id, is_approved, deactivated").eq("id", user.id).single();
  if (profileError || !profile) return { sb, user, profile: null, error: "Profile not found" };
  if (!profile.is_approved) return { sb, user, profile: null, error: "Account not approved" };
  if (profile.deactivated) return { sb, user, profile: null, error: "Account deactivated" };
  return { sb, user, profile };
}

export function hasRole(profile: { role_key: string } | null, requiredRoles: Role[]): boolean {
  if (!profile) return false;
  return requiredRoles.includes(profile.role_key as Role);
}

export function hasMinRole(profile: { role_key: string } | null, minRole: Role): boolean {
  if (!profile) return false;
  const userLevel = ROLE_HIERARCHY[profile.role_key as Role] ?? 0;
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= minLevel;
}

export function requireRole(profile: { role_key: string } | null, requiredRoles: Role[]): { error: string } | null {
  if (!hasRole(profile, requiredRoles)) {
    return { error: `Access denied. Required role: ${requiredRoles.join(" or ")}` };
  }
  return null;
}