
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/server";
import { ChevronLeft, Calendar, User, Tag, Clock } from "lucide-react";
import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const revalidate = 3600;

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { data } = await supabasePublic().from("blog_posts").select("title,excerpt").eq("slug", params.slug).eq("published",true).single();
  if (!data) return { title:"Post Not Found" };
  return {
    title: data.title,
    description: data.excerpt,
    openGraph:{ title:data.title, description:data.excerpt },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const site = await getSiteSettings();
  const sb = supabasePublic();
  const { data: post } = await sb.from("blog_posts")
    .select("*").eq("slug", params.slug).eq("published", true).single();
  if (!post) notFound();

  // Related posts (same tags, limit 3)
  const tags = post.tags ?? [];
  const { data: related } = await sb.from("blog_posts")
    .select("id,title,slug,excerpt,cover_image,published_at,author_name,reading_time")
    .eq("published", true).neq("id", post.id)
    .overlaps("tags", tags.length ? tags : ["general"])
    .limit(3);

  const publishDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})
    : new Date(post.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});

  const imgUrl = post.cover_image
    ? (post.cover_image.startsWith("http") ? post.cover_image : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/blog/${post.cover_image}`)
    : null;

  return (
    <div className="min-h-screen bg-white">
      <Header/>

      {/* Breadcrumb */}
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link>
        {" › "}<Link href="/blog" className="hover:underline">Blog</Link>
        {" › "}<span className="font-medium text-slate-700 truncate">{post.title}</span>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Back button */}
        <Link href="/blog" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700 mb-6 transition">
          <ChevronLeft size={16}/>Back to Blog
        </Link>

        {/* Article header */}
        <div className="mb-8">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((t: string) => (
                <span key={t} className="rounded-full bg-navy-50 border border-navy-100 px-3 py-1 text-xs font-semibold text-navy-700 flex items-center gap-1">
                  <Tag size={10}/>{t}
                </span>))}
            </div>)}
          <h1 className="font-extrabold text-3xl sm:text-4xl text-navy-900 leading-tight mb-4">{post.title}</h1>
          {post.excerpt && <p className="text-lg text-slate-500 leading-relaxed mb-5">{post.excerpt}</p>}
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 pb-5 border-b border-slate-100">
            <span className="flex items-center gap-1.5"><User size={14}/>{post.author_name ?? "Power Eyes Team"}</span>
            <span className="flex items-center gap-1.5"><Calendar size={14}/>{publishDate}</span>
            {post.reading_time && <span className="flex items-center gap-1.5"><Clock size={14}/>{post.reading_time} min read</span>}
          </div>
        </div>

        {/* Cover image */}
        {imgUrl && (
          <div className="rounded-2xl overflow-hidden mb-8 aspect-video bg-slate-100">
            <img src={imgUrl} alt={post.title} className="h-full w-full object-cover"/>
          </div>)}

        {/* Body */}
        <article
          className="prose prose-slate prose-headings:font-bold prose-headings:text-navy-900 prose-a:text-navy-700 prose-a:underline prose-img:rounded-xl prose-blockquote:border-l-gold-500 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.body ?? "" }}/>

        {/* CTA banner */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 text-white p-7 text-center">
          <p className="font-bold text-xl mb-1">Need expert eye care advice?</p>
          <p className="text-slate-300 text-sm mb-4">Our optometrists are available Mon–Sun 10 AM – 9 PM at both Mogappair stores.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/eye-test" className="rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-bold hover:bg-gold-600 transition">Book Eye Test</Link>
            <a href={waHref(site.whatsappNumber)} target="_blank" className="rounded-lg border-2 border-white/40 px-6 py-2.5 text-sm font-bold hover:bg-white/10 transition">💬 Ask on WhatsApp</a>
          </div>
        </div>

        {/* Related posts */}
        {(related ?? []).length > 0 && (
          <div className="mt-12">
            <h2 className="font-bold text-2xl text-navy-900 mb-5">Related Articles</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {(related ?? []).map((r: any) => {
                const rImg = r.cover_image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/blog/${r.cover_image}` : null;
                return (
                  <Link key={r.id} href={`/blog/${r.slug}`} className="group rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
                    <div className="aspect-video bg-slate-100">
                      {rImg ? <img src={rImg} alt={r.title} className="h-full w-full object-cover group-hover:scale-105 transition duration-300"/>
                             : <div className="h-full flex items-center justify-center text-3xl text-slate-200">📰</div>}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-sm text-navy-900 leading-snug line-clamp-2 group-hover:text-gold-600 transition">{r.title}</p>
                      {r.excerpt && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.excerpt}</p>}
                      <p className="text-xs text-slate-400 mt-2">{r.author_name ?? "Power Eyes Team"}</p>
                    </div>
                  </Link>);})}
            </div>
          </div>)}
      </div>

      <Footer/>
    </div>);
}

