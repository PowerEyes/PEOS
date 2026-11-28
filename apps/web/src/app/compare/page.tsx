
import { supabasePublic } from "@/lib/supabase/server";
import Link from "next/link";
import { imgUrl, inr, disc } from "@/lib/types";
import { Check, X, ChevronLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Compare Frames " };

export default async function ComparePage({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = (searchParams.ids ?? "").split(",").filter(Boolean).slice(0, 3);
  const products = ids.length
    ? (await supabasePublic().from("public_catalog").select("*").in("id", ids)).data ?? []
    : [];
  const ordered = ids.map(id => products.find((p: any) => p.id === id)).filter(Boolean) as any[];

  const ROWS = [
    { label:"Brand",       key:(p:any) => p.brand ?? "—" },
    { label:"Model",       key:(p:any) => p.model },
    { label:"Price",       key:(p:any) => inr(p.selling_price) },
    { label:"Discount",    key:(p:any) => disc(p.mrp,p.selling_price) ? `${disc(p.mrp,p.selling_price)}% OFF` : "No discount" },
    { label:"Gender",      key:(p:any) => <span className="capitalize">{p.gender ?? "—"}</span> },
    { label:"Shape",       key:(p:any) => p.attrs?.shape ?? "—" },
    { label:"Material",    key:(p:any) => p.attrs?.material ?? "—" },
    { label:"Colour",      key:(p:any) => p.attrs?.color ?? "—" },
    { label:"Lens Width",  key:(p:any) => p.attrs?.lens_width ? `${p.attrs.lens_width}mm` : "—" },
    { label:"Frame Width", key:(p:any) => p.attrs?.frame_width ? `${p.attrs.frame_width}mm` : "—" },
    { label:"Temple Arm",  key:(p:any) => p.attrs?.temple ? `${p.attrs.temple}mm` : "—" },
    { label:"Prescription",key:(p:any) => p.power_eligible ? <span className="text-emerald-600 font-semibold flex items-center gap-1"><Check size={14}/>Compatible</span> : <span className="text-slate-400 flex items-center gap-1"><X size={14}/>Frame only</span> },
    { label:"In Stock",    key:(p:any) => p.in_stock ? <span className="text-emerald-600 font-semibold">✓ In Stock</span> : <span className="text-rose-500">Out of stock</span> },
    { label:"Bestseller",  key:(p:any) => p.bestseller ? <span className="text-gold-600 font-semibold">★ Yes</span> : "No" },
    { label:"New Arrival", key:(p:any) => p.new_arrival ? <span className="text-blue-600 font-semibold">New</span> : "—" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/eyeglasses" className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-700"><ChevronLeft size={16}/>Back to shop</Link>
          <h1 className="font-bold text-2xl text-navy-900">Compare Frames</h1>
          <span className="text-sm text-slate-400">({ordered.length} of 3)</span>
        </div>

        {ordered.length === 0
          ? <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
              <p className="text-slate-500 text-lg mb-4">No products selected for comparison.</p>
              <Link href="/eyeglasses" className="rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700">Browse Frames</Link>
            </div>
          : <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="w-36 px-4 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature</th>
                    {ordered.map(p => (
                      <th key={p.id} className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-24 w-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mx-auto">
                            {p.images?.[0] ? <img src={imgUrl(p.images[0])!} alt={p.model} className="h-full w-full object-contain p-2"/> : <span className="text-3xl">👓</span>}
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{p.brand}</p>
                            <p className="font-bold text-sm text-navy-900">{p.model}</p>
                          </div>
                          <a href={`/product/${p.id}`} className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-bold text-white hover:bg-gold-600 transition">
                            {p.power_eligible ? "Choose Lenses" : "Add to Bag"}
                          </a>
                        </div>
                      </th>))}
                    {ordered.length < 3 && (
                      <th className="px-4 py-4 text-center">
                        <Link href="/eyeglasses" className="flex flex-col items-center gap-2 text-slate-400 hover:text-navy-700 transition">
                          <div className="h-24 w-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-3xl mx-auto">+</div>
                          <p className="text-xs font-medium">Add frame to compare</p>
                        </Link>
                      </th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, ri) => (
                    <tr key={row.label} className={`border-b border-slate-50 ${ri%2===0?"bg-white":"bg-slate-50/50"}`}>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">{row.label}</td>
                      {ordered.map(p => (
                        <td key={p.id} className="px-4 py-3 text-sm text-center text-slate-700">{row.key(p)}</td>))}
                      {ordered.length < 3 && <td className="px-4 py-3"/>}
                    </tr>))}
                </tbody>
              </table>
            </div>}
      </div>
      <Footer/>
    </div>);
}

