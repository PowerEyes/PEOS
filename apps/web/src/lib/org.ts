// Resolves the tenant for the current site from the database (site_domains / resolve_org) — nothing hardcoded.
// Works in the browser (window.location.host) and on the server (request Host header).
export type SiteOrg = { id: string; city: string; state: string; pincode: string };
const cache = new Map<string, Promise<SiteOrg>>();

async function currentHost(): Promise<string | null> {
  if (typeof window !== "undefined") return window.location.host;
  try { const { headers } = await import("next/headers"); return headers().get("host"); } catch { return null; }
}

export async function siteOrg(sb: any): Promise<SiteOrg> {
  const host = (await currentHost()) ?? "";
  let p = cache.get(host);
  if (!p) {
    p = (async () => {
      const { data: id, error } = await sb.rpc("resolve_org", { p_host: host });
      if (error || !id) throw new Error("This site is not linked to an organisation (add a row to site_domains).");
      const get = async (k: string) => (await sb.rpc("org_default_text", { p_key: k, p_fallback: "", p_org: id })).data ?? "";
      const [city, state, pincode] = await Promise.all([get("default_city"), get("default_state"), get("default_pincode")]);
      return { id, city, state, pincode } as SiteOrg;
    })();
    p.catch(() => cache.delete(host));
    cache.set(host, p);
  }
  return p;
}
