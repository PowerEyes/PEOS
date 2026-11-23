import { cookies } from "next/headers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * The branch a person is currently "looking at". UI convenience only: security is enforced by row-level security,
 * never by this cookie. Owners/admins default to ALL branches; everyone else defaults to their home branch.
 * Returns null for "all branches".
 */
export function resolveScope(role: string, homeBranch: string | null, validIds: string[]): string | null {
  const c = cookies().get("pe_branch")?.value;
  if (c === "all") return null;
  if (c && UUID.test(c) && validIds.includes(c)) return c;
  return ["owner", "admin"].includes(role) ? null : homeBranch && validIds.includes(homeBranch) ? homeBranch : null;
}

import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
/**
 * Server-side scope for pages: `scope` (branch id or null = all) plus `only(query)` which adds `branch_id = scope`
 * to a branch-owned table query. Use it on EVERY list/report query of a branch-owned table so the switcher is honoured everywhere.
 */
export const getScopeCtx = cache(async () => {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const [{ data: p }, { data: brs }] = await Promise.all([
    sb.from("profiles").select("role_key, branch_id").eq("id", user?.id ?? "").maybeSingle(),
    sb.from("branches").select("id").eq("is_active", true)]);
  const scope = resolveScope(p?.role_key ?? "staff", p?.branch_id ?? null, (brs ?? []).map((b: any) => b.id));
  return { scope, only: <T,>(q: T, col = "branch_id"): T => (scope ? (q as any).eq(col, scope) : q) };
});
