import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Server-side tenant resolution. Every public page read goes through getOrgId(),
// so it must agree with the RLS org chosen by request_org(). The old version only
// checked org_domains and env DEFAULT_ORG_ID; when neither was configured it threw,
// getPage() swallowed the error, and every CMS-backed route rendered the 404 page.
// Resolution order is now: org_domains → site_domains/default org → env fallback.
const cache = new Map<string, { id: string; at: number }>();
export const serviceDb = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
};

function currentHost(): string {
  const h = headers();
  return (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export async function getOrgId(): Promise<string> {
  const host = currentHost();
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.id;

  const sb = serviceDb();
  let id: string | null = null;

  // 1. Explicit host → org mapping (ERP > Settings > Store Domains).
  try {
    const { data } = await sb.rpc("org_for_host", { p_host: host });
    id = (data as string | null) ?? null;
  } catch {}

  // 2. site_domains, including its default_org() fallback. This is the same
  //    resolver used by the rest of the storefront, so the two can't disagree.
  if (!id) {
    try {
      const { data } = await sb.rpc("resolve_org", { p_host: host });
      id = (data as string | null) ?? null;
    } catch {}
  }

  // 3. Explicit default_org() (covers an older DB without resolve_org).
  if (!id) {
    try {
      const { data } = await sb.rpc("default_org");
      id = (data as string | null) ?? null;
    } catch {}
  }

  // 4. Deployment env fallback.
  if (!id) id = process.env.DEFAULT_ORG_ID ?? null;

  if (!id) throw new Error(`No organisation is mapped to host "${host || "(none)"}" and DEFAULT_ORG_ID is not set`);
  cache.set(host, { id, at: Date.now() });
  return id;
}
