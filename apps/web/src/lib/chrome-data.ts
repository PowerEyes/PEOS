// Site chrome: shared types + the hardcoded fallbacks.
//
// This module is deliberately PURE — no imports, no Supabase, no React. That
// lets the server loader (lib/chrome.ts) and the client Header/Footer all
// consume it without dragging server-only code into the browser bundle.
//
// Semantics used throughout:
//   `null`  → the section row is missing from website_sections for this anon
//             caller, i.e. an operator hid it with the eye toggle. Render
//             nothing — that is the whole point of the toggle.
//   object  → render it. Fields may be empty strings when the section exists
//             but its content rows were deleted; callers fall back to the
//             DEFAULT_* constant below so the site never loses its chrome.

export type NavItem = { label: string; href: string; mega?: string[][] };
export type FooterItem = { label: string; href: string };
export type FooterCol = { title: string; items: FooterItem[] };
export type FooterContact = { icon: string; label: string; href: string };

export type Announcement = { text: string; ctaLabel: string; ctaHref: string };
export type Logo = {
  icon: string;
  title: string;
  badge: string | null;
  tagline: string;
  image: string | null;
  imageAlt: string | null;
};
export type FooterChrome = {
  brand: { title: string; badge: string; tagline: string };
  contact: FooterContact[];
  social: FooterContact[];
  columns: FooterCol[];
  trust: string[];
};

export type SiteChrome = {
  announcement: Announcement | null;
  logo: Logo | null;
  nav: NavItem[] | null;
  footer: FooterChrome | null;
  storeName?: string;
};

/* ── Fallbacks: byte-for-byte what the site rendered before Phase 5 ─────── */

export const DEFAULT_ANNOUNCEMENT: Announcement = {
  text: "Eyeglasses, sunglasses, contact lenses and free eye tests",
  ctaLabel: "WhatsApp Support",
  ctaHref: "", // resolved at render time from site settings (Header → waHref(whatsappNumber))
};

export const DEFAULT_LOGO: Logo = {
  icon: "👁",
  title: "", // filled from the store name in lib/chrome.ts
  badge: "",
  tagline: "",
  image: null,
  imageAlt: null,
};

// Fallback mega-menu columns. Website Studio can now author its own JSON in a
// nav row's `body`; these defaults are used only when no CMS menu exists.
const EYEGASSES_MEGA: string[][] = [
  ["By Shape", "Round", "Square", "Rectangle", "Cat Eye", "Aviator", "Oval"],
  ["By Brand", "Ray-Ban", "Vogue", "Oakley", "Titan", "John Jacobs", "Lenskart"],
  ["By Need", "Computer Glasses", "Progressive", "Reading", "Kids Eyewear"],
];

export const DEFAULT_NAV: NavItem[] = [
  { label: "Eyeglasses", href: "/eyeglasses", mega: EYEGASSES_MEGA },
  { label: "Sunglasses", href: "/sunglasses" },
  { label: "Contact Lenses", href: "/contact-lenses" },
  { label: "Computer Glasses", href: "/computer-glasses" },
  { label: "Kids Eyewear", href: "/eyeglasses?gender=kids" },
  { label: "Lens & Coatings", href: "/lenses" },
  { label: "Offers", href: "/offers" },
  { label: "Eye Test", href: "/eye-test" },
  { label: "About Us", href: "/about" },
];

export const DEFAULT_FOOTER: FooterChrome = {
  brand: {
    title: "", // filled from the store name in lib/chrome.ts
    badge: "",
    tagline: "Expert eye care and premium eyewear for every generation.",
  },
  contact: [], // addresses/phones come from branches and settings, never defaults
  social: [],
  columns: [
    { title: "Shop", items: [
      { label: "Eyeglasses", href: "/eyeglasses" },
      { label: "Sunglasses", href: "/sunglasses" },
      { label: "Kids Eyewear", href: "/eyeglasses?gender=kids" },
      { label: "Contact Lenses", href: "/contact-lenses" },
      { label: "Lens Packages", href: "/lenses" },
      { label: "Accessories", href: "/accessories" },
    ]},
    { title: "Eye Care", items: [
      { label: "Book Eye Test", href: "/eye-test" },
      { label: "EYES Consultation", href: "/help-me-choose" },
      { label: "Upload Prescription", href: "/my/prescriptions" },
      { label: "Lens Guide", href: "/lens-guide" },
      { label: "Eye Care Blog", href: "/blog" },
    ]},
    { title: "My Account", items: [
      { label: "My account", href: "/my" },
      { label: "Vision ID", href: "/my/vision-id" },
      { label: "My Orders", href: "/my/orders" },
      { label: "Track Order", href: "/track-order" },
      { label: "Loyalty Rewards", href: "/my/loyalty" },
      { label: "Wishlist", href: "/wishlist" },
    ]},
    { title: "Support", items: [
      { label: "Store Locator", href: "/store-locator" },
      { label: "Warranty & Repairs", href: "/my/repairs" },
      { label: "Easy Returns", href: "/returns" },
      { label: "FAQs", href: "/faq" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ]},
  ],
  trust: ["100% Genuine Products", "Prescription Verified", "Free Adjustments", "Easy Returns", "Secure Payments", "Dedicated Support"],
};
