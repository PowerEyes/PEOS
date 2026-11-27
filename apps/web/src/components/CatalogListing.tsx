import { Suspense } from "react";
import { supabasePublic } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductFilters } from "@/components/ProductFilters";
import { GuideButton } from "@/components/SizeGuide";
import { buildFacets, applyFilters, priceBounds, type Sp } from "@/lib/facets";
import { getPage } from "@/lib/pages";
import { siteImgUrl, type Product } from "@/lib/types";

/** Shared, database-driven listing: filters, sort, guide button and hero text all come from the DB. */
export async function CatalogListing({ slug, kind, filter, sp, fallback, tone = "from-navy-900 to-navy-800", headless = false }: {
  slug: string; kind: string; sp: Sp; fallback: { title: string; subtitle: string }; tone?: string; headless?: boolean;
  filter?: (q: any) => any;
}) {
  const sb = supabasePublic();
  let q = sb.from("public_catalog").select("*").eq("kind", kind).order("bestseller", { ascending: false }).order("selling_price");
  if (filter) q = filter(q);
  const [{ data }, hero] = await Promise.all([q.limit(300), getPage(`hero-${slug}`)]);
  const rows = (data ?? []) as any[];
  const facets = buildFacets(rows);
  const shown = applyFilters(rows, sp, facets);
  const img = siteImgUrl(hero?.hero_image);
  return (<>
    {!headless && (
      <div className={`relative overflow-hidden bg-gradient-to-r ${tone} px-4 py-10 text-center text-white sm:py-14`}>
        {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="relative"><h1 className="font-display text-3xl font-bold sm:text-4xl">{hero?.title ?? fallback.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-200 sm:text-base">{hero?.subtitle ?? fallback.subtitle}</p></div>
      </div>)}
    <div id="products" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-end pt-4"><GuideButton page={slug} /></div>
      <div className="grid gap-6 pt-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Suspense fallback={null}><ProductFilters facets={facets} bounds={priceBounds(rows)} total={rows.length} shown={shown.length} /></Suspense>
        <div className="min-w-0"><ProductGrid products={shown as Product[]} kind={kind as any} brands={[]} /></div>
      </div>
    </div>
  </>);
}
