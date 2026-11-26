import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Faq } from "@/components/Faq";
import { getPage } from "@/lib/pages";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
import { siteImgUrl } from "@/lib/types";

/** Policy / FAQ style page rendered 100% from site_pages (ERP > Website > Pages & Guides). */
export async function ContentPage({ slug }: { slug: string }) {
  const [p, site] = await Promise.all([getPage(slug), getSiteSettings()]); if (!p) notFound();
  const b = p.body as any; const img = siteImgUrl(p.hero_image);
  const wa = waHref(site.whatsappNumber);
  return (<div className="min-h-screen bg-slate-50"><Header /><Breadcrumb strip items={[{ label: p.title }]} />
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 px-4 py-12 text-center text-white sm:py-16">
      {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="relative mx-auto max-w-2xl"><h1 className="font-display text-3xl font-bold sm:text-4xl">{p.title}</h1>{p.subtitle && <p className="mt-2 text-slate-200">{p.subtitle}</p>}</div></section>
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
      {b.callout && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center"><p className="text-lg font-bold text-emerald-800">{b.callout.title}</p><p className="mt-1 text-sm text-emerald-700">{b.callout.text}</p></div>}
      {[...(b.sections ?? []), ...(b.extra ? [b.extra] : [])].map((s: any, i: number) => (
        <article key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          {s.heading && <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-navy-900">{s.icon && <span>{s.icon}</span>}{s.heading}</h2>}
          {s.body && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.body}</p>}
          {s.items?.length ? <ul className="space-y-2">{s.items.map((t: string, n: number) => <li key={n} className="flex items-start gap-2 text-sm text-slate-600"><span className={`mt-0.5 shrink-0 ${s.icon === "✗" ? "text-rose-500" : "text-gold-500"}`}>{s.icon === "✗" ? "✗" : "•"}</span>{t}</li>)}</ul> : null}
        </article>))}
      {b.faq && <Faq groups={b.faq} />}
      <div className="rounded-2xl border border-navy-100 bg-navy-50 p-6 text-center"><p className="font-bold text-navy-900">Still have a question?</p><p className="mt-1 text-sm text-slate-600">We are happy to help.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3"><a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">💬 WhatsApp</a><Link href="/contact" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700">Contact us</Link></div></div>
    </div><Footer /></div>);
}
