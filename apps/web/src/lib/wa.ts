// Pure WhatsApp / Instagram link helpers — safe to import from client AND server code.

export const DEFAULT_WA_NUMBER = "919840496404";

// wa.me link for a business number. 10-digit numbers get the +91 country code.
// With text, opens WhatsApp prefilled with the message (URL-encoded).
export function waHref(number: string, text?: string): string {
  let d = (number ?? "").replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`;
  if (!d) d = DEFAULT_WA_NUMBER;
  const base = `https://wa.me/${d}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// Instagram profile link — accepts a handle (@name / name) or a full URL.
export function igHref(handle: string): string {
  const v = (handle ?? "").trim();
  if (!v) return "";
  if (v.startsWith("http")) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}
