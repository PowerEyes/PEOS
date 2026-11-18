import { Suspense } from "react";
import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGrid } from "@/components/ProductGrid";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProductFilters } from "@/components/ProductFilters";
import { SizeGuide } from "@/components/SizeGuide";
import type { Product } from "@/lib/types";
export const revalidate = 60;
export const metadata = { title: "Eyeglasses – Prescription Frames", description: "Shop eyeglasses, prescription frames and optical frames." };

const uniq = (rows: any[] | null, f: (r: any) => string | undefined) =>
  [...new Set((rows ?? []).map(f).filter(Boolean) as string[])].sort();
const boundsOf = (rows: any[] | null) => {
  const p = (rows ?? []).map((r: any) => Number(r.selling_price)).filter((n) => Number.isFinite(n) && n > 0);
  if (!p.length) return { min: 0, max: 10000 };
  return { min: Math.floor(Math.min(...p) / 100) * 100, max: Math.ceil(Math.max(...p) / 100) * 100 };
};

export default async function EyeglassesPage({ searchParams }: { searchParams: Record<string,string> }) {
  const sb = supabasePublic();
  let q = sb.from("public_catalog").select("*").eq("kind","frame").order("bestseller",{ascending:false});
  // ilike so lowercase links (?shape=round from homepage / search suggestions)
  // match the stored "Round" value case-insensitively.
  if (searchParams.shape) q = q.ilike("attrs->>shape", searchParams.shape);
  if (searchParams.gender) q = q.eq("gender", searchParams.gender);
  if (searchParams.brand) q = q.eq("brand", searchParams.brand);
  if (Number(searchParams.min) > 0) q = q.gte("selling_price", Number(searchParams.min));
  if (Number(searchParams.max) > 0) q = q.lte("selling_price", Number(searchParams.max));
  const { data } = await q.limit(100);
  // Unfiltered pass feeds the filter panel (distinct brands / shapes / prices).
  const { data: all } = await sb.from("public_catalog").select("brand, gender, attrs, selling_price").eq("kind","frame").limit(100);
  const brands  = uniq(all, (r) => r.brand);
  const shapes  = uniq(all, (r) => r.attrs?.shape);
  const genders = uniq(all, (r) => r.gender);
  const bounds  = boundsOf(all);

  const crumbs = [
    { label: "Eyeglasses" },
    ...(searchParams.brand ? [{ label: String(searchParams.brand) }] : []),
    ...(searchParams.shape ? [{ label: String(searchParams.shape) }] : []),
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Breadcrumb strip items={crumbs} />
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-10 px-4 text-white text-center">
        <h1 className="font-display text-4xl font-bold">Eyeglasses</h1>
        <p className="mt-2 text-slate-300">Prescription frames for every face and lifestyle</p>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end pt-4">
          <SizeGuide />
        </div>
        <Suspense fallback={null}>
          <ProductFilters brands={brands} shapes={shapes} genders={genders} bounds={bounds} />
        </Suspense>
        <ProductGrid products={(data ?? []) as Product[]} brands={brands} kind="frame"/>
      </div>
      <Footer/>
    </div>);
}
