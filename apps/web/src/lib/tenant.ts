import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Server-side tenant resolution: request host → organization (org_domains).
// In production, an unknown host must fail closed instead of silently falling
// back to the default shop. Set ALLOW_DEFAULT_ORG_FALLBACK=true only for an
// intentionally single-tenant deployment.
const cache = new Map<string, { id: string; at: number }>();
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;

export const serviceDb = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
};

function requestHost(): string {
  const h = headers();
  const raw = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(",")[0].trim().toLowerCase();
  const host = raw.replace(/:\d+$/, "").replace(/\.$/, "");
  const labels = host.split(".");
  const valid = host.length <= 253 && labels.length > 0 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (!valid) throw new Error("Request host is missing or invalid");
  return host;
}

export async function getOrgId(): Promise<string> {
  const host = requestHost();
  const now = Date.now();
  const hit = cache.get(host);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.id;
  if (hit) cache.delete(host);

  const { data, error } = await serviceDb().rpc("org_for_host", { p_host: host });
  if (error) throw new Error(`Could not resolve organization for host "${host}"`);
  const allowFallback = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEFAULT_ORG_FALLBACK === "true";
  const id = (data as string | null) ?? (allowFallback ? process.env.DEFAULT_ORG_ID : undefined);
  if (!id) throw new Error(`No organization is mapped to host "${host}"`);

  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [key, value] of cache) {
      if (now - value.at >= CACHE_TTL_MS) cache.delete(key);
      if (cache.size < CACHE_MAX_ENTRIES) break;
    }
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  }
  cache.set(host, { id, at: now });
  return id;
}
