import { supabasePublic } from "@/lib/supabase/server";
export async function GET() {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? "https://www.powereyes.in";
  const { data: products } = await supabasePublic().from("public_catalog").select("id").limit(1000);
  const static_urls = ["/","/eyeglasses","/sunglasses","/contact-lenses","/lenses","/eye-test","/help-me-choose","/store-locator","/blog","/about"].map(p=>({ url:`${base}${p}`, priority: p==="/"?"1.0":"0.8" }));
  const product_urls = (products??[]).map(p => ({ url:`${base}/product/${p.id}`, priority:"0.6" }));
  const all = [...static_urls, ...product_urls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${all.map(u=>`<url><loc>${u.url}</loc><priority>${u.priority}</priority></url>`).join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
