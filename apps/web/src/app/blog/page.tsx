import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
export const revalidate = 300;
export const metadata = { title: "Eye Care Blog & Guides – Power Eyes Opticals" };
const GUIDES = [
  { title:"How to read your spectacle prescription", slug:"read-prescription", tag:"Guide", excerpt:"OD, OS, SPH, CYL, AXIS, ADD — we decode every term on your Rx card.", emoji:"📋" },
  { title:"Progressive vs Bifocal lenses — which is right for you?", slug:"progressive-vs-bifocal", tag:"Comparison", excerpt:"Both correct near and far vision, but the experience is very different.", emoji:"🔭" },
  { title:"Blue light glasses: do they actually help?", slug:"blue-light-glasses", tag:"Science", excerpt:"We look at the evidence behind blue-light blocking lenses for screen users.", emoji:"💻" },
  { title:"How often should you get an eye test?", slug:"eye-test-frequency", tag:"Health", excerpt:"The answer depends on your age, existing prescription and eye health.", emoji:"👁️" },
  { title:"Guide to face shapes and frame styles", slug:"face-shapes-frames", tag:"Style", excerpt:"Find the frames that suit your face shape — with real examples.", emoji:"🕶️" },
  { title:"Contact lenses vs glasses: pros and cons", slug:"contact-vs-glasses", tag:"Guide", excerpt:"A practical guide to choosing between contacts and spectacles.", emoji:"🔄" },
];
export default async function Page() {
  const site = await getSiteSettings();
  const { data: posts } = await supabasePublic().from("blog_posts").select("id,slug,title,excerpt,tags,author,published_at,cover_image").eq("status","published").order("published_at",{ascending:false}).limit(20);
  const all = posts?.length ? posts.map((p:any) => ({ title:p.title, slug:`/blog/${p.slug}`, tag:p.tags?.[0]??"Blog", excerpt:p.excerpt??"", emoji:"📝" })) : GUIDES;
  return (<div className="min-h-screen bg-white"><Header/>
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-14 px-4 text-center text-white">
      <h1 className="font-display text-4xl font-bold">Eye Care Guides & Blog</h1>
      <p className="mt-2 text-slate-300">Expert advice on vision care, eyewear and eye health</p></div>
    <div className="mx-auto max-w-5xl section-pad px-4 space-y-10">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {all.map(g => (
          <div key={g.slug} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
            <div className="h-36 bg-gradient-to-br from-navy-50 to-blue-50 flex items-center justify-center text-5xl">{g.emoji}</div>
            <div className="p-4 space-y-2">
              <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-semibold text-gold-700">{g.tag}</span>
              <h2 className="font-bold text-navy-900 group-hover:text-navy-700 leading-snug">{g.title}</h2>
              <p className="text-sm text-slate-500 line-clamp-2">{g.excerpt}</p>
              <a href={g.slug.startsWith("/blog")? g.slug : `/blog/${g.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">Read more →</a>
            </div>
          </div>))}
      </div>
      <div className="rounded-2xl bg-gradient-to-r from-gold-500 to-gold-600 p-8 text-white text-center">
        <h2 className="font-display text-2xl font-bold">Have an eye care question?</h2>
        <p className="mt-2 text-white/80">Our optometrists are available via WhatsApp or in-store consultation.</p>
        <div className="mt-5 flex justify-center gap-3"><a href={waHref(site.whatsappNumber)} target="_blank" className="btn-navy">💬 Ask on WhatsApp</a><Link href="/eye-test" className="btn-outline">Book Consultation</Link></div>
      </div>
    </div><Footer/></div>);
}
