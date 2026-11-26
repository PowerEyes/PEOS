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
  text: "",
  ctaLabel: "",
  ctaHref: "",
};

export const DEFAULT_LOGO: Logo = {
  icon: "👁",
  title: "POWER EYES",
  badge: "OPTICALS",
  tagline: "Since 1998 — Your Family's Vision Partner",
  image: null,
  imageAlt: null,
};

// Mega-menu columns are NOT in the CMS — they stay hardcoded and are re-attached
// by label, so renaming a nav row simply drops its dropdown rather than
// breaking navigation.
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
    title: "",
    badge: "",
    tagline: "",
  },
  contact: [],
  social: [],
  columns: [],
  trust: [],
};
