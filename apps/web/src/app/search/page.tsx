import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import type { Product } from "@/lib/types";
export const metadata = { title: "Search – Power Eyes Opticals" };

const CATEGORIES = [
  { label: "Eyeglasses", href: "/eyeglasses", e: "👓" },
  { label: "Sunglasses", href: "/sunglasses", e: "🕶️" },
  { label: "Contact Lenses", href: "/contact-lenses", e: "👁️" },
  { label: "Computer Glasses", href: "/computer-glasses", e: "🖥️" },
  { label: "Kids Eyewear", href: "/kids", e: "🧒" },
  { label: "Offers", href: "/offers", e: "🎉" },
];

/** Small edit distance — used to power "did you mean …?" on zero results. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function Categories() {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-500">Popular categories</p>
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <a key={c.href} href={c.href}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-navy-700 hover:text-navy-900">
            <span>{c.e}</span>{c.label}
          </a>))}
      </div>
    </div>);
}

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  let products: Product[] = [];
  let suggestion: string | null = null;

  if (q.length >= 2) {
    const sb = supabasePublic();
    const { data } = await sb.from("public_catalog").select("*")
      .or(`model.ilike.%${q}%,brand.ilike.%${q}%,sku.ilike.%${q}%,short_desc.ilike.%${q}%`).limit(60);
    products = (data ?? []) as Product[];

    if (!products.length) {
      // Zero results — find the closest brand name for "did you mean …?"
      const { data: rows } = await sb.from("public_catalog").select("brand").limit(300);
      const brands = [...new Set((rows ?? []).map((r: any) => r.brand).filter(Boolean))] as string[];
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const nq = norm(q);
      let best: { b: string; d: number } | null = null;
      for (const b of brands) {
        const nb = norm(b);
        if (!nb) continue;
        const d = nb.includes(nq) || nq.includes(nb) ? 1 : editDistance(nq, nb);
        const tolerance = Math.max(1, Math.floor(nb.length / 3));
        if (d <= tolerance && (!best || d < best.d)) best = { b, d };
      }
      suggestion = best?.b ?? null;
    }
  }

  const crumbs = [{ label: "Search" }, ...(q ? [{ label: `“${q}”` }] : [])];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Breadcrumb strip items={crumbs} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-navy-900 mb-2">{q ? `Results for “${q}”` : "Search"}</h1>
        <p className="text-slate-500 mb-8">{q ? `${products.length} product${products.length === 1 ? "" : "s"} found` : "Enter a search term above."}</p>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : q.length >= 2 ? (
          <div className="py-16 text-center">
            <span className="text-5xl mb-4 block">🔍</span>
            <p className="font-semibold text-lg text-slate-600">No products found for “{q}”.</p>
            {suggestion ? (
              <p className="mt-2 text-slate-500">
                Did you mean{" "}
                <a href={`/search?q=${encodeURIComponent(suggestion)}`}
                  className="font-semibold text-navy-800 underline decoration-gold-400 underline-offset-4 hover:text-gold-600">
                  {suggestion}
                </a>?
              </p>
            ) : (
              <p className="mt-2 text-slate-400">Check the spelling, or try a brand or model name.</p>
            )}
            <div className="mt-10"><Categories /></div>
          </div>
        ) : (
          <div className="py-16"><Categories /></div>
        )}
      </div>
      <Footer />
    </div>);
}
