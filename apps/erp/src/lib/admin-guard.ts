import { supabaseServer } from "@/lib/supabase/server";
/** Owner/admin check for pages and actions that use RPCs or the service role. */
export async function adminCtx() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from("profiles").select("role_key,org_id,full_name").eq("id", user.id).single();
  if (!p || (p.role_key !== "owner" && p.role_key !== "admin")) return null;
  return { sb, user, orgId: p.org_id as string, name: p.full_name as string | null };
}
