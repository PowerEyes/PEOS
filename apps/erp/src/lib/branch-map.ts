// Branch Google-Map normalisation — shared by the Settings form (live preview)
// and the server actions (authoritative save).
//
// One input field accepts anything a store manager is likely to paste:
//   • the <iframe> embed HTML from Google Maps → Share → "Embed a map"
//   • any Google Maps link (place URL, /@lat,lng URL, ?q= URL, embed URL)
//   • plain text — a street address or place name
//
// Everything is normalised down to a single embeddable URL built on the
// keyless `output=embed` endpoint, and the final URL is validated
// (https + *.google.com host + /maps path) so ONLY a safe URL is ever stored —
// raw HTML never reaches the database or the page.

export type MapEmbedResult = { url: string; error?: string };

const isGoogleHost = (host: string) =>
  host === "google.com" || host === "www.google.com" || host === "maps.google.com" || host.endsWith(".google.com");

const embedFromQuery = (q: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(q.replace(/\s+/g, " ").trim())}&output=embed`;

export function normalizeMapEmbed(input: string): MapEmbedResult {
  let s = (input ?? "").trim();
  if (!s) return { url: "" };

  // 1) Pasted embed snippet → pull the src out of the <iframe …>.
  const iframeSrc = s.match(/<iframe\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i);
  if (iframeSrc) s = iframeSrc[1].trim();
  else if (/<iframe/i.test(s)) return { url: "", error: "That embed code has no src — copy the full <iframe …> snippet." };

  // Protocol-relative URLs (//www.google.com/…) from older snippets.
  if (s.startsWith("//")) s = `https:${s}`;

  // 2) Plain address / place name → keyless embed search.
  if (!/^https?:\/\//i.test(s)) {
    return { url: embedFromQuery(s) };
  }

  let u: URL;
  try { u = new URL(s); } catch { return { url: "", error: "That doesn't look like a valid link." }; }

  if (u.hostname.endsWith(".goo.gl")) {
    return { url: "", error: "Short (maps.app.goo.gl) links can't be embedded — use Share → Embed a map, or paste the address instead." };
  }
  if (!isGoogleHost(u.hostname)) {
    return { url: "", error: "Please paste a Google Maps link, its embed code, or the branch address." };
  }

  // 3) Already an embed URL → keep exactly as-is.
  if (u.pathname.startsWith("/maps/embed") || u.searchParams.get("output") === "embed") {
    return { url: u.toString() };
  }

  // 4) Place URL: /maps/place/<name>/… → search the name.
  if (u.pathname.includes("/maps/place/")) {
    const raw = u.pathname.split("/maps/place/")[1] ?? "";
    const name = decodeURIComponent(raw.split("/@")[0]).replace(/\+/g, " ").trim();
    if (name) return { url: embedFromQuery(name) };
  }

  // 5) Coordinates URL: /maps/…/@lat,lng → centre on the coords.
  const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { url: embedFromQuery(`${at[1]},${at[2]}`) };

  // 6) /maps?query=… / ?q=… → use the query.
  const q = u.searchParams.get("q") || u.searchParams.get("query");
  if (q) return { url: embedFromQuery(decodeURIComponent(q)) };

  return {
    url: "",
    error: "Couldn't read a location from that link — use Share → Embed a map, or paste the branch address.",
  };
}

/** Render-time guard (website): is this one of our validated embed URLs? */
export function isSafeMapEmbed(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && isGoogleHost(u.hostname) && u.pathname.startsWith("/maps");
  } catch { return false; }
}
