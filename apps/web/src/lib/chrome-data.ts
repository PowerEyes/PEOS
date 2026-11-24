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
};

/* ── Fallbacks: byte-for-byte what the site rendered before Phase 5 ─────── */

export const DEFAULT_ANNOUNCEMENT: Announcement = {
  text: "Mogappair East, Chennai · Your Family's Vision Partner Since 1998",
  ctaLabel: "WhatsApp Support",
  ctaHref: "", // resolved at render time from site settings (Header → waHref(whatsappNumber))
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
    title: "POWER EYES",
    badge: "SINCE 1998",
    tagline: "Your Family's Vision Partner. Expert eye care and premium eyewear for every generation.",
  },
  contact: [
    { icon: "map", label: "2/56 Velayapathi Salai, Mogappair East, Chennai – 600 037", href: "https://maps.google.com/?q=2%2F56+Velayapathi+Salai+Mogappair+East+Chennai" },
    { icon: "phone", label: "98401 85186", href: "tel:+919840185186" },
    { icon: "mail", label: "powereyes.chennai@gmail.com", href: "mailto:powereyes.chennai@gmail.com" },
  ],
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
      { label: "My Power Eyes", href: "/my" },
      { label: "Vision ID", href: "/my/vision-id" },
      { label: "My Orders", href: "/my/orders" },
      { label: "Track Order", href: "/my/orders" },
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
