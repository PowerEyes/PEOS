// CMS links are operator-authored, so treat "" / "#" / unsafe schemes as
// "no link" and fall back to a real route instead of a dead anchor.
export function safeHref(href: unknown, fallback = "/"): string {
  const v = typeof href === "string" ? href.trim() : "";
  if (!v || v === "#") return fallback;
  if (/^(javascript|data|vbscript):/i.test(v) || v.startsWith("//")) return fallback;
  return v;
}
