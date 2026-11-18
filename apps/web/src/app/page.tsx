import Link from "next/link";
import { Fragment } from "react";
import { isPreviewEnabled, supabasePreview, supabasePublic } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { imgUrl, siteImgUrl, SHAPES, LENS_TYPES, LIFESTYLE } from "@/lib/types";
import type { Product } from "@/lib/types";
import { MapPin, ChevronRight, ArrowRight, MessageCircle } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref, igHref } from "@/lib/wa";

// Instant cache. The ERP's Website Controller writes straight to Supabase, so an
// operator hitting Save must see it on the next load — not in 60s. revalidate=0
// opts this route out of ISR entirely; every request renders from the DB.
export const revalidate = 0;

// Blocks rendered by <Header/> / <Footer/> rather than by the section loop
// below. They still carry registry rows (so they can be hidden/reordered in the
// ERP) but their markup lives in those components — Phase 5 wires that up.
const CHROME = new Set(["announcement", "site_logo", "nav", "footer"]);

async function getData(preview: boolean) {
  // Preview has to read through the elevated client: ws_anon / wc_anon strip
  // disabled and inactive rows at the database, so the anon key would return
  // exactly the rows preview exists to show as missing.
  const sb = preview ? supabasePreview() : supabasePublic();
  // `is_active` is already enforced by wc_anon for the public client — dropping
  // it here is what lets a card be staged before it is switched on.
  const contentQuery = preview
    ? sb.from("website_content").select("*")
    : sb.from("website_content").select("*").eq("is_active", true);
  // One round trip for everything. The previous version also ran a second,
  // sequential query to resolve each review's frame — embedding products()
  // instead removes that waterfall entirely.
  const [{ data: sections }, { data: content }, { data: featured }, { data: sunBest }, { data: branches }, { data: reviews }] = await Promise.all([
    sb.from("website_sections").select("*").order("display_order"),
    contentQuery.order("section").order("display_order"),
    sb.from("public_catalog").select("*").eq("kind", "frame").eq("bestseller", true).limit(6),
    sb.from("public_catalog").select("*").eq("kind", "sunglass").eq("bestseller", true).limit(6),
    sb.from("branches").select("name,address,phone,image_path,image_alt").eq("is_active", true).order("name"),
    sb.from("product_reviews")
      .select("id,reviewer_name,rating,title,body,images,created_at,product_id,products(id,model,images,visible_on_website,brands(name))")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(20),
  ]);

  // Enrich UGC: attach the frame's name + photo (review photo when the customer
  // attached one, otherwise the product shot). `visible_on_website` reproduces
  // the old public_catalog lookup — a delisted frame must not surface here.
  const ugc = (reviews ?? [])
    .map((r: any) => ({ ...r, product: r.products ? {
      brand: r.products.brands?.name ?? null, model: r.products.model,
      images: r.products.images, visible: r.products.visible_on_website,
    } : null }))
    .filter((r: any) => r.images?.length || (r.product?.visible && r.product?.images?.length))
    .slice(0, 10);

  return {
    sections: (sections ?? []) as any[],
    content: (content ?? []) as any[],
    featured: (featured ?? []) as Product[],
    sunBest: (sunBest ?? []) as Product[],
    branches: (branches ?? []) as any[],
    ugc: ugc as any[],
  };
}

/**
 * Preview-only label above a block that is not fully live. The section key is
 * shown verbatim so it maps to the ERP row without guessing, and any inactive
 * cards inside are named rather than counted so staged work is identifiable.
 */
function PreviewMarker({ off, label, inactive }: { off: boolean; label: string; inactive: string[] }) {
  const name = label.replace(/_/g, " ");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y-2 border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-[11px] text-amber-900 sm:px-6 lg:px-8">
      <span className="font-semibold uppercase tracking-wider">{name}</span>
      {off && <span className="text-amber-700">— switched off in the ERP, shown here for preview</span>}
      {/* One expression, not several text runs — React's SSR emits <!-- -->
          between adjacent text nodes, which would split the sentence. */}
      {inactive.length > 0 && (
        <span className="text-amber-700">
          {`${off ? "and " : "— "}${inactive.length} card${inactive.length === 1 ? "" : "s"} hidden from visitors: ${inactive.join(", ")}`}
        </span>
      )}
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: { preview?: string; k?: string } }) {
  const preview = isPreviewEnabled(searchParams);
  const site = await getSiteSettings();
  const { sections, content, featured, sunBest, branches, ugc } = await getData(preview);

  // Registry order IS page order — dragging a section in the ERP moves it here.
  // ws_anon already hides disabled rows from this anon client; the filter keeps
  // the intent explicit and protects against a policy change. Preview skips it
  // on purpose: seeing the switched-off blocks is the entire point.
  const visible = preview ? sections : sections.filter((s: any) => s.enabled !== false);
  const renderable = visible.filter((s: any) => !CHROME.has(s.key));
  // Adjacency is measured over what actually renders, so padding only collapses
  // when the neighbouring band is genuinely on the page.
  const pos = (k: string) => renderable.findIndex((s: any) => s.key === k);
  const prevOf = (k: string) => renderable[pos(k) - 1]?.key;
  const nextOf = (k: string) => renderable[pos(k) + 1]?.key;

  const rowsOf = (k: string) => content.filter((c: any) => c.section === k);

  // What preview has to annotate: sections switched off, plus cards switched off
  // inside sections that are otherwise live. Titles are collected rather than
  // counted so the operator can tell at a glance *which* card is staged.
  const hiddenSections = new Set(sections.filter((s: any) => s.enabled === false).map((s: any) => s.key));
  const inactiveBySection = new Map<string, string[]>();
  if (preview) for (const c of content) if (!c.is_active) {
    const list = inactiveBySection.get(c.section) ?? [];
    list.push(c.title || c.key || "(untitled card)");
    inactiveBySection.set(c.section, list);
  }
  // Shared responsive horizontal padding of `section-pad` (globals.css is
  // `px-4 py-14 sm:px-6 lg:px-8`). Used when a band must drop one side of its
  // vertical padding without also emitting py-*, which Tailwind does not
  // guarantee to resolve in our favour.
  const GUT = "px-4 sm:px-6 lg:px-8";

  return (
    <div className="min-h-screen bg-white">
      {preview && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-dashed border-amber-500 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 sm:px-6 lg:px-8">
          <span>Preview mode — hidden blocks and cards are shown below. Visitors never see these.</span>
          <a href="/" className="ml-auto rounded-lg bg-navy-900 px-2.5 py-1 text-white transition hover:bg-navy-800">Exit preview</a>
        </div>
      )}
      <Header />
      {/* Preview has to annotate individual blocks, so the section loop's output
          is post-processed here instead of threading a `preview` flag through
          all thirteen render branches. */}
      {(() => {
        const blocks = renderable.map((s: any, i: number) => {
        const prev = renderable[i - 1]?.key;
        const next = renderable[i + 1]?.key;

        /* ─── HERO ─────────────────────────────────────────────── */
        if (s.key === "hero") {
          const items = rowsOf("hero");
          const main = items.find((x: any) => x.key === "main") ?? {
            title: "Your Family's Vision Partner",
            subtitle: "Eyewear, eye care and expert guidance for every generation.",
            badge: "Since 1998", cta_label: "Shop Eyewear", cta_link: "/eyeglasses",
            cta2_label: "Book Eye Test", cta2_link: "/eye-test",
          };
          const badgeRow = items.find((x: any) => x.key === "badge") ?? { title: "Clearer Vision", subtitle: "Brighter Days" };
          const feats = items.filter((x: any) => x.parent_key === "main");
          const featList = (feats.length ? feats : [
            { icon: "👁️", title: "Expert Eye Care" }, { icon: "📋", title: "Prescription Support" },
            { icon: "🏪", title: "Real Stores E&W" }, { icon: "👨‍👩‍👧", title: "Family Vision ID" },
          ]);
          const bg = siteImgUrl(s.image_path);
          return (
            <Fragment key={s.key}>
              <section className="relative min-h-[85vh] overflow-hidden bg-navy-900 flex items-center">
                <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/70 to-transparent z-10"/>
                {/* No uploaded image → the original gradient, never a broken box. */}
                {bg
                  ? <img src={bg} alt={s.image_alt || ""} className="absolute inset-0 h-full w-full object-cover"/>
                  : <div className="absolute inset-0 bg-gradient-to-br from-navy-800 via-slate-800 to-navy-900 opacity-80"/>}
                <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
                  <div className="max-w-2xl text-white space-y-6 animate-slide-up">
                    {main.badge && <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase">{main.badge}</p>}
                    <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight">{main.title}</h1>
                    {main.subtitle && <p className="text-xl text-slate-300">{main.subtitle}</p>}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {main.cta_label && <Link href={main.cta_link || "#"} className="btn-gold text-base px-8 py-4">{main.cta_label}</Link>}
                      {main.cta2_label && <Link href={main.cta2_link || "#"} className="btn-outline text-base px-8 py-4">{main.cta2_label}</Link>}
                    </div>
                    {featList.length > 0 && (
                      <div className="flex flex-wrap gap-6 pt-4 text-sm text-slate-400">
                        {featList.map((f: any, n: number) => (
                          <span key={f.key || n} className="flex items-center gap-2">{f.icon} {f.title}</span>))}
                      </div>)}
                  </div>
                </div>
                <div className="absolute right-0 bottom-6 z-20 text-center px-6 hidden lg:block">
                  <div className="inline-block rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-4 text-white text-right">
                    <p className="font-display text-2xl font-bold italic">{badgeRow.title}<br/>{badgeRow.subtitle}</p>
                  </div>
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── CATEGORY CARDS ───────────────────────────────────── */
        if (s.key === "category_card") {
          const items = rowsOf("category_card");
          const cards = items.length ? items : [
            { title: "Eyeglasses", subtitle: "For everyday life", cta_link: "/eyeglasses", bg_color: "from-blue-50 to-blue-100", icon: "🕶️" },
            { title: "Sunglasses", subtitle: "Style meets protection", cta_link: "/sunglasses", bg_color: "from-amber-50 to-amber-100", icon: "😎" },
            { title: "Kids Eyewear", subtitle: "Growing eyes, brighter tomorrows", cta_link: "/eyeglasses?gender=kids", bg_color: "from-emerald-50 to-emerald-100", icon: "👧" },
            { title: "Lenses", subtitle: "Advanced vision for a better you", cta_link: "/lenses", bg_color: "from-violet-50 to-violet-100", icon: "🔬" },
          ];
          return (
            <Fragment key={s.key}>
              <section className="mx-auto max-w-7xl section-pad">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {cards.map((c: any) => {
                    const img = siteImgUrl(c.image_path);
                    return (
                      <Link key={c.key || c.title} href={c.cta_link || "#"} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.bg_color || "from-slate-50 to-slate-100"} p-5 transition hover:-translate-y-1 hover:shadow-lg`}>
                        <div className="text-3xl mb-2">
                          {img ? <img src={img} alt={c.image_alt || ""} className="h-16 w-16 rounded-xl object-cover"/> : c.icon}
                        </div>
                        <p className="font-bold text-navy-900">{c.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600 hidden sm:block">{c.subtitle}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-700">Shop Now <ArrowRight size={12}/></span>
                      </Link>);})}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── FIND YOUR PERFECT FRAME ──────────────────────────── */
        if (s.key === "frame_finder") {
          const tabs = rowsOf("frame_finder");
          const tabList = tabs.length ? tabs : ["By Shape", "By Face Shape", "By Lifestyle", "By Need", "By Gender", "Help Me Choose"]
            .map((t, n) => ({ title: t, cta_link: n === 5 ? "/help-me-choose" : "/eyeglasses" }));
          // Collapsing the bottom padding keeps the shape grid inside this same
          // grey band, exactly as it renders when both blocks are adjacent.
          const cls = next === "shape_chip"
            ? `bg-slate-50 ${GUT} pt-14`
            : "bg-slate-50 section-pad";
          return (
            <Fragment key={s.key}>
              <section className={cls}>
                <div className="mx-auto max-w-7xl">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Find Your Perfect Frame"}</h2>
                      {s.subtitle && <p className="text-slate-500 mt-1">{s.subtitle}</p>}
                    </div>
                    {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">{s.cta_label} <ChevronRight size={15}/></Link>}
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
                    {tabList.map((t: any, idx: number) => (
                      <Link key={t.key || t.title} href={t.cta_link || "#"} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${idx === 0 ? "bg-navy-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-navy-700"}`}>{t.title}</Link>))}
                  </div>
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── SHAPE CHIPS (sits directly under frame_finder) ───── */
        if (s.key === "shape_chip") {
          const items = rowsOf("shape_chip");
          const chips = items.length ? items : SHAPES.map((t) => ({ title: t, icon: "👓", cta_link: `/eyeglasses?shape=${t.toLowerCase()}` }));
          // Top padding only when it is NOT continuing frame_finder's band.
          const cls = prev === "frame_finder"
            ? `bg-slate-50 ${GUT} pb-14`
            : "bg-slate-50 section-pad";
          return (
            <Fragment key={s.key}>
              <section className={cls}>
                <div className="mx-auto max-w-7xl">
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                    {chips.map((c: any, n: number) => {
                      const img = siteImgUrl(c.image_path);
                      return (
                        <Link key={c.key || n} href={c.cta_link || "#"} className="group flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-white hover:shadow-sm">
                          <div className="h-12 w-16 rounded-xl bg-slate-200 group-hover:bg-navy-50 transition flex items-center justify-center overflow-hidden">
                            {img ? <img src={img} alt={c.image_alt || ""} className="h-full w-full object-cover"/> : <span className="text-lg">{c.icon || "👓"}</span>}
                          </div>
                          <span className="text-xs text-slate-600 font-medium">{c.title}</span>
                        </Link>);})}
                  </div>
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── BEST SELLERS ─────────────────────────────────────── */
        if (s.key === "best_seller") {
          const tabs = rowsOf("best_seller");
          const tabList = tabs.length ? tabs : [
            { title: "Eyeglasses", cta_link: "/eyeglasses" }, { title: "Sunglasses", cta_link: "/sunglasses" }];
          return (
            <Fragment key={s.key}>
              <section className="mx-auto max-w-7xl section-pad">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Best Sellers"}</h2>
                    {s.subtitle && <p className="text-slate-500 mt-1">{s.subtitle}</p>}
                  </div>
                  {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">{s.cta_label} <ChevronRight size={15}/></Link>}
                </div>
                <div className="flex gap-2 mb-6">
                  {tabList.map((t: any, n: number) => (
                    <Link key={t.key || n} href={t.cta_link || "#"} className="rounded-full bg-navy-900 text-white px-4 py-1.5 text-sm font-medium">{t.title}</Link>))}
                </div>
                {featured.length > 0
                  ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{featured.map(p => <ProductCard key={p.id} p={p}/>)}</div>
                  : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100"/>)}</div>}
              </section>
            </Fragment>
          );
        }

        /* ─── COLLECTION BANNERS ───────────────────────────────── */
        if (s.key === "collection_banner") {
          const items = rowsOf("collection_banner");
          const fallback = [
            { title: "New Collection", subtitle: "Everyday Frames For Every Story", cta_link: "/eyeglasses" },
            { title: "Progressive Lenses", subtitle: "Seamless Vision At Every Distance", cta_link: "/lenses" },
            { title: "Prescription Sunglasses", subtitle: "See Clearly Everywhere", cta_link: "/sunglasses" },
          ];
          const banners = items.length ? items : fallback;
          // Gradient cycles in the same order as before (index 0/1/other).
          const grad = (i: number) => i === 0 ? "from-navy-800 to-navy-900" : i === 1 ? "from-slate-800 to-slate-900" : "from-slate-700 to-navy-800";
          return (
            <Fragment key={s.key}>
              <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  {banners.map((b: any, i: number) => {
                    const img = siteImgUrl(b.image_path);
                    return (
                      <Link key={b.key || b.id || b.title} href={b.cta_link || "/eyeglasses"} className={`group relative overflow-hidden rounded-2xl ${grad(i)} p-7 text-white transition hover:-translate-y-1 hover:shadow-xl`}>
                        {img && <img src={img} alt={b.image_alt || ""} className="absolute inset-0 h-full w-full object-cover opacity-40"/>}
                        <div className="relative">
                          {b.badge && <p className="text-xs font-semibold uppercase tracking-wider text-gold-400 mb-2">{b.badge}</p>}
                          <p className="font-display text-2xl font-bold leading-tight">{b.title}</p>
                          <p className="mt-1 text-sm text-slate-300">{b.subtitle}</p>
                          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-400 group-hover:gap-3 transition-all">{b.cta_label || "Shop Now"} <ArrowRight size={15}/></span>
                        </div>
                      </Link>);})}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── LENS TYPES ───────────────────────────────────────── */
        if (s.key === "lens_type") {
          const items = rowsOf("lens_type");
          const list = items.length ? items : LENS_TYPES.map(l => ({ ...l, title: l.label, subtitle: l.desc, bg_color: l.color, cta_link: `/lenses?type=${l.key}` }));
          return (
            <Fragment key={s.key}>
              <section className="bg-slate-50 section-pad">
                <div className="mx-auto max-w-7xl">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Smarter Vision Starts Here"}</h2>
                      {s.subtitle && <p className="text-slate-500 mt-1">{s.subtitle}</p>}
                    </div>
                    {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">{s.cta_label} <ChevronRight size={15}/></Link>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {list.map((lt: any, n: number) => {
                      const img = siteImgUrl(lt.image_path);
                      return (
                        <Link key={lt.key || n} href={lt.cta_link || "#"} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${lt.bg_color || "from-navy-800 to-navy-700"} p-4 text-white transition hover:-translate-y-1 hover:shadow-lg`}>
                          {img && <img src={img} alt={lt.image_alt || ""} className="absolute inset-0 h-full w-full object-cover opacity-30"/>}
                          <div className="relative">
                            <p className="font-semibold text-sm">{lt.title}</p>
                            <p className="text-[11px] text-white/70 mt-0.5">{lt.subtitle}</p>
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/90">Explore <ArrowRight size={11}/></span>
                          </div>
                        </Link>);})}
                  </div>
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── LIFESTYLE CHIPS ──────────────────────────────────── */
        if (s.key === "lifestyle_chip") {
          const items = rowsOf("lifestyle_chip");
          const list = items.length ? items : LIFESTYLE.map(({ l, e }) => ({ title: l, icon: e, cta_link: `/eyeglasses?lifestyle=${l.toLowerCase()}` }));
          return (
            <Fragment key={s.key}>
              <section className="mx-auto max-w-7xl section-pad">
                <div className="flex items-end justify-between mb-6">
                  <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Frames for Your Life"}</h2>
                  {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">{s.cta_label} <ChevronRight size={15}/></Link>}
                </div>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {list.map((c: any, n: number) => {
                    const img = siteImgUrl(c.image_path);
                    return (
                      <Link key={c.key || n} href={c.cta_link || "#"} className="group flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-navy-50">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-xl transition group-hover:scale-105 overflow-hidden">
                          {img ? <img src={img} alt={c.image_alt || ""} className="h-full w-full object-cover"/> : c.icon}
                        </div>
                        <span className="text-xs font-medium text-slate-700">{c.title}</span>
                      </Link>);})}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── FEATURE CARDS (Not sure / Family vision) ─────────── */
        if (s.key === "feature_card") {
          const items = rowsOf("feature_card");
          const parents = items.filter((x: any) => !x.parent_key);
          if (!parents.length) return <Fragment key={s.key}/>;
          return (
            <Fragment key={s.key}>
              <section className="bg-slate-50 section-pad">
                <div className="mx-auto max-w-7xl grid gap-4 sm:grid-cols-2">
                  {parents.map((p: any) => {
                    const kids = items.filter((x: any) => x.parent_key === p.key);
                    const navy = p.bg_color === "navy";
                    return (
                      <div key={p.key} className={navy
                        ? "rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-8 text-white"
                        : "rounded-2xl bg-white p-8 shadow-sm"}>
                        <h3 className={navy ? "font-display text-2xl font-bold" : "font-display text-2xl font-bold text-navy-900"}>{p.title}</h3>
                        <p className={navy ? "mt-2 text-slate-300 text-sm" : "mt-1 text-slate-500 text-sm"}>{p.subtitle}</p>
                        {navy ? (
                          <ul className="mt-4 space-y-2 text-sm text-slate-300">
                            {kids.map((k: any) => <li key={k.key} className="flex items-center gap-2">✓ {k.title}</li>)}
                          </ul>
                        ) : (
                          <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                            {kids.map((k: any) => {
                              const img = siteImgUrl(k.image_path);
                              return (
                                <Link key={k.key} href={k.cta_link || "#"} className="group rounded-xl border border-slate-100 p-3 hover:border-gold-400 transition">
                                  <div className="text-2xl mb-1">{img ? <img src={img} alt={k.image_alt || ""} className="mx-auto h-8 w-8 rounded-lg object-cover"/> : k.icon}</div>
                                  <span className="text-xs font-medium text-slate-700">{k.title}</span>
                                </Link>);})}
                          </div>
                        )}
                        {p.cta_label && <Link href={p.cta_link || "#"} className={navy ? "btn-gold mt-6 w-full" : "btn-gold mt-5 w-full"}>{p.cta_label}</Link>}
                      </div>);})}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── OUR STORES ───────────────────────────────────────── */
        if (s.key === "stores") {
          // The gold eye-test CTA is its own registry block (`promo`) but lives
          // inside this grid; when both are adjacent the padding is split so the
          // pair still reads as one band.
          const cls = next === "promo"
            ? `mx-auto max-w-7xl ${GUT} pt-14`
            : "mx-auto max-w-7xl section-pad";
          return (
            <Fragment key={s.key}>
              <section className={cls}>
                <div className="flex items-end justify-between mb-6">
                  <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Our Stores in Mogappair"}</h2>
                  {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">{s.cta_label} <ChevronRight size={15}/></Link>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {branches.map((b: any) => (
                    <div key={b.name} className="card flex gap-4 p-5">
                      <div className="h-16 w-16 shrink-0 rounded-xl bg-navy-50 flex items-center justify-center text-2xl overflow-hidden">
                        {siteImgUrl(b.image_path)
                          ? <img src={siteImgUrl(b.image_path)!} alt={b.image_alt || ""} className="h-full w-full object-cover"/>
                          : "🏪"}
                      </div>
                      <div><p className="font-bold text-navy-900">{b.name}</p><p className="text-sm text-slate-500 mt-0.5">{b.address}</p><p className="text-sm text-slate-500 mt-0.5">{b.phone}</p>
                        <div className="mt-3 flex gap-2">
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(b.address ?? "")} Power Eyes`} target="_blank" className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-navy-700"><MapPin size={12}/>Directions</a>
                          <a href={waHref(site.whatsappNumber)} target="_blank" className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-emerald-600 text-emerald-700"><MessageCircle size={12}/>WhatsApp</a>
                        </div>
                      </div>
                    </div>))}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── PROMO (gold eye-test CTA, inside the stores grid) ── */
        if (s.key === "promo") {
          const item = rowsOf("promo")[0] ?? {
            title: "Book an Eye Test Today",
            subtitle: "Professional eye care for you and your family at our Mogappair stores.",
            cta_label: "Book Eye Test →", cta_link: "/eye-test", bg_color: "from-gold-500 to-gold-600",
          };
          const img = siteImgUrl(item.image_path);
          // pt-4 restores the grid gap the row used to get from stores' `gap-4`.
          const cls = prev === "stores"
            ? `mx-auto max-w-7xl ${GUT} pt-4 pb-14`
            : "mx-auto max-w-7xl section-pad";
          return (
            <Fragment key={s.key}>
              <section className={cls}>
                <div className={`relative overflow-hidden rounded-2xl ${item.bg_color || "from-gold-500 to-gold-600"} p-6 flex items-center justify-between flex-wrap gap-4`}>
                  {img && <img src={img} alt={item.image_alt || ""} className="absolute inset-0 h-full w-full object-cover opacity-30"/>}
                  <div className="relative"><p className="font-display text-xl font-bold text-white">{item.title}</p><p className="text-white/80 text-sm">{item.subtitle}</p></div>
                  {item.cta_label && <Link href={item.cta_link || "#"} className="btn-navy whitespace-nowrap relative">{item.cta_label}</Link>}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── TOP SUNGLASSES ───────────────────────────────────── */
        if (s.key === "top_sunglasses") {
          if (!sunBest.length) return null;
          return (
            <Fragment key={s.key}>
              <section className="bg-slate-50 section-pad">
                <div className="mx-auto max-w-7xl">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Top Sunglasses"}</h2>
                      {s.subtitle && <p className="text-slate-500 mt-1">{s.subtitle}</p>}
                    </div>
                    {s.cta_label && <Link href={s.cta_link || "#"} className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700">{s.cta_label} <ChevronRight size={15}/></Link>}
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{sunBest.slice(0, 4).map(p => <ProductCard key={p.id} p={p}/>)}</div>
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── AS SEEN ON YOU ───────────────────────────────────── */
        if (s.key === "ugc") {
          const tiles = rowsOf("ugc");
          const showUs = tiles.find((t: any) => t.key === "show_us");
          const manual = tiles.filter((t: any) => t.key !== "show_us");
          // Reviews are the primary source (unchanged from before). With none
          // approved yet, fall back to the seeded manual tiles rather than
          // dropping the whole block — otherwise those CMS rows are unreachable.
          const useReviews = ugc.length > 0;
          if (!useReviews && !manual.length) return null;
          return (
            <Fragment key={s.key}>
              <section className="mx-auto max-w-7xl section-pad">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <h2 className="font-display text-3xl font-bold text-navy-900">{s.title || "Looks We Love From You"}</h2>
                    {s.subtitle && <p className="text-slate-500 mt-1">{s.subtitle}</p>}
                  </div>
                  <a href={igHref(site.instagram) || "https://instagram.com"} target="_blank" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-navy-700">📸 Instagram</a>
                </div>
                <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
                  {useReviews
                    ? ugc.map((r: any) => {
                        const url = imgUrl(r.images?.[0]) || (r.product?.visible ? imgUrl(r.product?.images?.[0]) : null);
                        const pname = r.product ? [r.product.brand, r.product.model].filter(Boolean).join(" ") : "";
                        return (
                          <figure key={r.id} className="w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(10,34,64,.06)]">
                            <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-white">
                              {url ? <img src={url} alt={`Review by ${r.reviewer_name}`} className="h-full w-full object-cover" loading="lazy"/>
                                : <div className="flex h-full items-center justify-center text-4xl">👓</div>}
                            </div>
                            <figcaption className="p-4">
                              <div className="flex gap-0.5 text-gold-500" aria-label={`${r.rating} out of 5 stars`}>
                                {[1,2,3,4,5].map(n => <span key={n} className={n <= r.rating ? "" : "text-slate-200"}>★</span>)}
                              </div>
                              {r.body && <p className="mt-2 line-clamp-3 text-sm text-slate-600">&ldquo;{r.body}&rdquo;</p>}
                              <p className="mt-2.5 truncate text-xs font-semibold text-navy-900">{r.reviewer_name}{pname && ` · ${pname}`}</p>
                            </figcaption>
                          </figure>);})
                    : manual.map((t: any) => {
                        const img = siteImgUrl(t.image_path);
                        return (
                          <figure key={t.key} className="w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(10,34,64,.06)]">
                            <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-white">
                              {img ? <img src={img} alt={t.image_alt || t.title} className="h-full w-full object-cover" loading="lazy"/>
                                : <div className="flex h-full items-center justify-center text-4xl">{t.icon || "👓"}</div>}
                            </div>
                            <figcaption className="p-4">
                              <p className="text-sm font-semibold text-navy-900">{t.title}</p>
                              {t.subtitle && <p className="mt-1 text-xs text-slate-500">{t.subtitle}</p>}
                            </figcaption>
                          </figure>);})}
                  {/* The seeded CTA tile closes the rail whether it is showing
                      reviews or the manual fallback tiles. */}
                  {showUs && (
                    <figure className="w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-navy-900 to-navy-800 p-6 text-white shadow-[0_2px_8px_rgba(10,34,64,.06)] flex flex-col justify-center">
                      <div className="text-3xl mb-2">{siteImgUrl(showUs.image_path) ? <img src={siteImgUrl(showUs.image_path)!} alt="" className="h-12 w-12 rounded-xl object-cover"/> : showUs.icon}</div>
                      <p className="font-display text-lg font-bold">{showUs.title}</p>
                      {showUs.subtitle && <p className="mt-1 text-sm text-slate-300">{showUs.subtitle}</p>}
                    </figure>)}
                </div>
              </section>
            </Fragment>
          );
        }

        /* ─── WHATSAPP FLOAT ───────────────────────────────────── */
        if (s.key === "whatsapp_cta") {
          const item = rowsOf("whatsapp_cta")[0] ?? { title: "Chat on WhatsApp", icon: "💬", cta_link: waHref(site.whatsappNumber) };
          return (
            <Fragment key={s.key}>
              <a href={item.cta_link || waHref(site.whatsappNumber)} target="_blank" rel="noopener"
                className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-emerald-600 transition hover:-translate-y-0.5">
                {item.icon} {item.title}
              </a>
            </Fragment>
          );
        }

        return null;
      });
        if (!preview) return blocks;
        // Marker first, then the block it belongs to, so the label is read
        // before the content it is warning about.
        return blocks.flatMap((el: any, i: number) => {
          const s = renderable[i];
          const off = hiddenSections.has(s.key);
          const inactive = inactiveBySection.get(s.key) ?? [];
          if (!off && !inactive.length) return [el];
          return [
            <PreviewMarker key={`${s.key}__preview`} off={off} label={s.key} inactive={inactive} />,
            el,
          ];
        });
      })()}
      <Footer />
    </div>
  );
}
