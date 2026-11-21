import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Server-side tenant resolution: request host → organisation (org_domains). DEFAULT_ORG_ID covers
// localhost / preview hosts / single-tenant installs.
const cache = new Map<string, { id: string; at: number }>();
export const serviceDb = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
};
export async function getOrgId(): Promise<string> {
  const h = headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.id;
  const { data } = await serviceDb().rpc("org_for_host", { p_host: host });
  const id = (data as string | null) ?? process.env.DEFAULT_ORG_ID;
  if (!id) throw new Error(`No organisation is mapped to host "${host}" and DEFAULT_ORG_ID is not set`);
  cache.set(host, { id, at: Date.now() });
  return id;
}
