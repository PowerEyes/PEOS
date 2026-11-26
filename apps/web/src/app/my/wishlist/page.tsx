import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import { supabaseServer } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { Heart } from "lucide-react";
import Link from "next/link";
export default async function Page() {
  const c = await getCustomer(); if (!c) redirect("/my/login");
  const { data: wl } = await supabaseServer().from("customer_wishlist").select("product_id, created_at").eq("customer_id", c.id).order("created_at", { ascending: false });
  const ids = (wl??[]).map(w=>w.product_id);
  const { data: products } = ids.length ? await supabaseServer().from("public_catalog").select("*").in("id",ids) : { data: [] };
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-900">My Wishlist</h1>
      {!(products?.length) ? <div className="card p-16 text-center"><Heart size={40} className="mx-auto mb-3 text-slate-300"/><p className="font-semibold text-slate-600">Your wishlist is empty</p><Link href="/eyeglasses" className="btn-gold mt-5 inline-flex">Explore Eyeglasses</Link></div>
        : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{products.map((p:any)=><ProductCard key={p.id} p={p}/>)}</div>}
    </div>);
}
