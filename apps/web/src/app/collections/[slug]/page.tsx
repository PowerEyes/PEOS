import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumb } from "@/components/Breadcrumb";
import { notFound } from "next/navigation";
export const revalidate = 60;
export default async function Page({ params }: { params: { slug: string } }) {
  const name = params.slug.replace(/-/g," ");
  const { data: products } = await supabasePublic().from("public_catalog").select("*").ilike("collection", `%${name}%`).limit(60);
  if (!products?.length) notFound();
  return (<div className="min-h-screen bg-white"><Header/>
    <Breadcrumb strip items={[{ label: "Collections" }, { label: name }]} />
    <div className="bg-gradient-to-r from-navy-900 to-navy-700 py-14 px-4 text-center text-white">
      <p className="text-gold-400 text-sm font-semibold uppercase tracking-wider mb-2">Collection</p>
      <h1 className="font-display text-4xl font-bold capitalize">{name}</h1>
    </div>
    <div className="mx-auto max-w-6xl section-pad px-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{products.map((p:any)=><ProductCard key={p.id} p={p}/>)}</div>
    </div>
    <Footer/></div>);
}
