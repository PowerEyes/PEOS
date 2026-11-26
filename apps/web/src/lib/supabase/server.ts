import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// request_org() in Postgres reads this header to scope anon reads to the
// storefront tenant. Without it, RLS falls back to the default org, which can
// disagree with getOrgId() and turn /about into a 404 on mapped hosts.
function siteHeaders(): Record<string, string> {
  try {
    const h = headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
    return host ? { "x-site-host": host } : {};
  } catch {
    return {};
  }
}

export const supabasePublic = () => createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: siteHeaders() }, cookies: { getAll: () => [], setAll: () => {} } });

// Next patches global fetch and, unless a segment opts out, memoises the
// response in its Data Cache across requests. That is fatal for a CMS read
// path: the root layout's chrome query would keep returning the values it saw
// first, so an ERP edit or an eye-toggle appeared to do nothing until the
// server restarted. Every call through this client is explicitly `no-store`.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...(init as RequestInit), cache: "no-store" });

export const supabaseFresh = () => createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  global: { headers: siteHeaders() },
  cookies: { getAll: () => [], setAll: () => {} },
  fetch: noStoreFetch,
});

/**
 * Elevated client, used by `?preview=1` and nothing else.
 *
 * The anon key cannot see what preview exists to show: `ws_anon` filters
 * `enabled` and `wc_anon` filters `is_active` / `valid_until` at the database,
 * before the query runs. Service role skips RLS, so this returns disabled
 * sections, inactive cards and expired content — exactly the rows being staged.
 *
 * Only ever reach for this behind isPreviewEnabled(); handing it to an
 * ungated request would publish every hidden row on the site.
 */
export const supabasePreview = () => createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { global: { headers: siteHeaders() }, cookies: { getAll: () => [], setAll: () => {} }, fetch: noStoreFetch },
);

/**
 * True only for `?preview=1&k=<SITE_PREVIEW_KEY>` with a matching key.
 *
 * Deliberately returns false when the key is unset: a deployment that never
 * configured one has no preview mode, rather than an open one.
 */
export function isPreviewEnabled(sp?: { preview?: string | string[]; k?: string | string[] }): boolean {
  const key = process.env.SITE_PREVIEW_KEY;
  if (!key) return false;
  if (sp?.preview !== "1") return false;
  const k = sp.k;
  return typeof k === "string" && k === key;
}

export const supabaseServer = () => {
  const s = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: siteHeaders() },
    cookies: {
      getAll: () => s.getAll(),
      setAll: (l: CookieToSet[]) => { try { l.forEach(({ name, value, options }) => s.set(name, value, options)); } catch {} },
    },
  });
};
