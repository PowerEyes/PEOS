// Link rules for header/footer/menu content edited in the website controller.
// Internal links must point at a real storefront route or an active CMS page; external links must be https/mailto/tel.
export const WEB_ROUTES = ["about", "accessories", "blog", "cart", "checkout", "clinic", "collections", "compare", "computer-glasses", "contact", "contact-lenses", "eye-test", "eyeglasses", "faq", "help-me-choose", "kids", "lab", "lenses", "login", "my", "offers", "privacy", "product", "returns", "search", "store-locator", "sunglasses", "terms", "track-order", "wishlist"];
export function checkLink(raw: string | null | undefined, pageSlugs: string[] = []): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(javascript|data|vbscript):/i.test(v)) return "That link type is not allowed.";
  if (/^(https:\/\/|mailto:|tel:)/i.test(v)) return /^https:\/\/[^\s/]+\.[^\s/]+/i.test(v) || !/^https:/i.test(v) ? null : "Enter a full https:// address.";
  if (v === "#" || v.startsWith("#")) return null;
  if (!v.startsWith("/") || v.startsWith("//")) return "Use a path such as /about, or a full https:// address.";
  const seg = v.slice(1).split(/[?#]/)[0].split("/")[0].toLowerCase();
  if (seg === "") return null; // home
  return WEB_ROUTES.includes(seg) || pageSlugs.includes(seg) ? null : `“/${seg}” is not a page on your website. Create it under Pages & Guides first.`;
}
