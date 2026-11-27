import { isPreviewRequest, supabaseFresh, supabasePreview } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/tenant";
import { getStoreName } from "@/lib/site";
import { safeHref } from "@/lib/href";
import {
  DEFAULT_ANNOUNCEMENT, DEFAULT_LOGO, DEFAULT_NAV, DEFAULT_FOOTER,
  type SiteChrome, type Announcement, type Logo, type FooterChrome, type NavItem, type FooterContact,
} from "@/lib/chrome-data";

// The four chrome sections. Everything else on the site is rendered by the
// homepage's section loop; these four live in <Header/> / <Footer/> instead.
const KEYS = ["announcement", "site_logo", "nav", "footer"] as const;

type Row = Record<string, any>;
const byOrder = (a: Row, b: Row) => (a.display_order ?? 0) - (b.display_order ?? 0);

/** Studio stores the nav mega-menu as JSON in website_content.body. */
function parseMega(v: unknown): string[][] | undefined {
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    if (Array.isArray(parsed) && parsed.every((col) =>
      Array.isArray(col) && col.every((item) => typeof item === "string"))) {
      return parsed as string[][];
    }
  } catch { /* not JSON — fall back to the label-matched defaults */ }
  return undefined;
}

/**
 * Reads announcement / logo / nav / footer for the anon caller in ONE round
 * trip and resolves them against the hardcoded fallbacks.
 *
 * Called from the root layout only, so it costs a single request per render —
 * Header and Footer both read the result through ChromeProvider rather than
 * fetching for themselves.
 *
 * Contract (see chrome-data.ts):
 *   - section row ABSENT for this caller → the operator hid it → `null`
 *   - section row present, content missing/deleted → DEFAULT_*
 *   - a field left blank keeps its default; use the eye toggle to remove a
 *     whole block, because a blanked label must never produce an empty bar
 *   - ANY query failure → all defaults. A CMS hiccup must never ship a site
 *     with no navigation.
 *
 * Deliberately NOT wrapped in React `cache()`: the root layout is its only
 * caller, so there is nothing to deduplicate, and a cache that outlives a
 * single render would serve the same staleness problem as Next's fetch cache.
 */
export async function getSiteChrome(preview = isPreviewRequest()): Promise<SiteChrome> {
  const sb = preview ? supabasePreview() : supabaseFresh();
  // Service role ignores RLS — scope it to the current store when previewing.
  const orgId = preview ? await getOrgId() : null;
  const scope = (q: any) => (preview && orgId ? q.eq("org_id", orgId) : q);
  const today = new Date().toISOString().slice(0, 10);
  const contentQuery = preview
    ? sb.from("website_content").select("*")
    : sb.from("website_content").select("*").eq("is_active", true)
        .or(`valid_from.is.null,valid_from.lte.${today}`);

  const [{ data: sections, error: secErr }, { data: content, error: conErr }] = await Promise.all([
    scope(sb.from("website_sections").select("key,image_path,image_alt").in("key", [...KEYS])),
    scope(contentQuery.in("section", [...KEYS]).order("section").order("display_order")),
  ]);

  // Fail-closed to the fallbacks: a broken query or a wiped registry must not
  // leave the storefront without a header.
  if (secErr || conErr || !sections || sections.length === 0) {
    return {
      announcement: { ...DEFAULT_ANNOUNCEMENT },
      logo: DEFAULT_LOGO, nav: DEFAULT_NAV, footer: DEFAULT_FOOTER,
    };
  }

  const secMap = new Map<string, Row>(sections.map((s: Row) => [s.key, s]));
  const rowsFor = (sec: string) => ((content ?? []) as Row[]).filter((r) => r.section === sec);
  // ws_anon already drops disabled sections from this query, so "absent" and
  // "hidden" are the same thing here — that is what makes the eye toggle work.
  const hidden = (sec: string) => !secMap.has(sec);

  /* ── announcement bar ──────────────────────────────────────────────── */
  let announcement: Announcement | null = null;
  if (!hidden("announcement")) {
    const r = rowsFor("announcement")[0];
    announcement = {
      text: (r?.title || "") || DEFAULT_ANNOUNCEMENT.text,
      ctaLabel: r?.cta_label ?? "",
      ctaHref: r?.cta_link ?? "",
    };
  }

  /* ── logo ──────────────────────────────────────────────────────────── */
  let logo: Logo | null = null;
  if (!hidden("site_logo")) {
    const r = rowsFor("site_logo")[0];
    const s = secMap.get("site_logo");
    logo = {
      icon: r?.icon || DEFAULT_LOGO.icon,
      title: r?.title || DEFAULT_LOGO.title,
      badge: r?.badge ?? DEFAULT_LOGO.badge,
      tagline: r?.subtitle || DEFAULT_LOGO.tagline,
      image: s?.image_path ?? null,
      imageAlt: s?.image_alt ?? null,
    };
  }

  /* ── nav ───────────────────────────────────────────────────────────── */
  let nav: NavItem[] | null = null;
  if (!hidden("nav")) {
    const rows = rowsFor("nav").filter((r) => r.title); // drop label-less rows
    nav = rows.length
      ? rows.map((r) => ({
          label: r.title as string,
          href: safeHref(r.cta_link),
          mega: parseMega(r.body),
        }))
      : DEFAULT_NAV;
  }

  /* ── footer ────────────────────────────────────────────────────────── */
  let footer: FooterChrome | null = null;
  if (!hidden("footer")) {
    const rows = rowsFor("footer");
    if (!rows.length) {
      footer = DEFAULT_FOOTER;
    } else {
      const brand = rows.find((r) => r.key === "brand");
      const contacts: FooterContact[] = rows.filter((r) => r.parent_key === "brand").sort(byOrder)
        .filter((r) => r.title)
        .map((r) => ({ icon: r.icon || "map", label: r.title, href: safeHref(r.cta_link) }));
      const socials: FooterContact[] = rows.filter((r) => r.parent_key === "social").sort(byOrder)
        .filter((r) => r.title)
        .map((r) => ({ icon: r.icon || "instagram", label: r.title, href: safeHref(r.cta_link) }));
      const trust = rows.filter((r) => r.parent_key === "trust").sort(byOrder)
        .map((r) => r.title as string).filter(Boolean);

      // Column headers are the parent-less rows other than `brand`; their links
      // hang off parent_key. `social` and `trust` are virtual parents with no
      // header row of their own, hence the two branches above.
      const columns = rows.filter((r) => !r.parent_key && r.key !== "brand").sort(byOrder).map((c) => ({
        title: c.title as string,
        items: rows.filter((r) => r.parent_key === c.key).sort(byOrder)
          .filter((r) => r.title)
          .map((r) => ({ label: r.title as string, href: safeHref(r.cta_link) })),
      })).filter((c) => c.title);

      footer = {
        brand: {
          title: brand?.title || DEFAULT_FOOTER.brand.title,
          badge: brand?.badge || DEFAULT_FOOTER.brand.badge,
          tagline: brand?.subtitle || DEFAULT_FOOTER.brand.tagline,
        },
        contact: contacts.length ? contacts : DEFAULT_FOOTER.contact,
        social: socials.length ? socials : DEFAULT_FOOTER.social,
        columns: columns.length ? columns : DEFAULT_FOOTER.columns,
        trust: trust.length ? trust : DEFAULT_FOOTER.trust,
      };
    }
  }

  // Pages created in ERP > Website > Pages with "Show in website menu" are listed in the footer under "More" (database-driven).
  if (footer) {
    try {
      let pagesQuery = sb.from("site_pages").select("slug,title").eq("org_id", await getOrgId()).eq("kind", "page");
      // Preview reveals staged/hidden pages as well as live ones.
      if (!preview) pagesQuery = pagesQuery.eq("is_active", true).eq("show_in_nav", true);
      const { data: extra } = await pagesQuery.order("display_order");
      if (extra?.length) footer = { ...footer, columns: [...footer.columns, { title: "More", items: extra.map((x: any) => ({ label: x.title, href: `/${x.slug}` })) }] };
    } catch { /* keep the footer as is */ }
  }
  const storeName = await getStoreName();
  return {
    announcement,
    logo: logo ? { ...logo, title: logo.title || storeName } : null,
    nav,
    footer: footer ? { ...footer, brand: { ...footer.brand, title: footer.brand.title || storeName } } : null,
    storeName,
  };
}
