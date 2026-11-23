import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getPage } from "@/lib/pages";
import { siteImgUrl } from "@/lib/types";
import { supabasePublic } from "@/lib/supabase/server";
const LINKS = [["about", "About Us", "/about"], ["clinic", "Our Clinic", "/clinic"], ["lab", "Our Lab", "/lab"]];
/** Database-driven enterprise page (about / clinic / lab). Edit in ERP > Website > Pages & Guides. */
export async function EnterprisePage({ slug }: { slug: string }) {
  const p = await getPage(slug); if (!p) notFound();
  const { data: branches } = await supabasePublic().from("branches").select("name,address,phone").eq("is_active", true).order("name");
  const img = siteImgUrl(p.hero_image); const b = p.body;
  return (<div className="min-h-screen bg-white"><Header /><Breadcrumb strip items={[{ label: p.title }]} />
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 px-4 py-14 text-center text-white sm:py-20">
      {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="relative mx-auto max-w-3xl"><h1 className="font-display text-3xl font-bold sm:text-5xl">{p.title}</h1>{p.subtitle && <p className="mt-3 text-base text-slate-200 sm:text-lg">{p.subtitle}</p>}
        <div className="mt-6 flex justify-center gap-3"><Link href="/eye-test" className="btn-gold">Book an Eye Test</Link></div></div></section>
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:py-14">
      {b.stats?.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{b.stats.map((s, i) => <div key={i} className="rounded-2xl bg-navy-50 p-5 text-center"><p className="font-display text-3xl font-bold text-navy-900">{s.value}</p><p className="mt-1 text-xs text-slate-600">{s.label}</p></div>)}</div> : null}
      <div className="grid gap-5 sm:grid-cols-2">{(b.sections ?? []).map((s, i) => (
        <article key={i} className="card p-5 sm:p-6">{s.icon && <div className="mb-2 text-2xl">{s.icon}</div>}{s.heading && <h2 className="font-display text-lg font-bold text-navy-900 sm:text-xl">{s.heading}</h2>}{s.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.body}</p>}</article>))}</div>
      {(branches?.length ?? 0) > 0 && <section><h2 className="mb-4 text-center font-display text-xl font-bold text-navy-900">Visit us</h2><div className="grid gap-4 sm:grid-cols-2">{branches!.map((b: any) => <div key={b.name} className="card p-5"><p className="font-semibold text-navy-900">{b.name}</p>{b.address && <p className="mt-1 text-sm text-slate-600">{b.address}</p>}{b.phone && <a href={`tel:${b.phone}`} className="mt-2 inline-block text-sm font-semibold text-navy-700">{b.phone}</a>}</div>)}</div></section>}
      <nav aria-label="More about us" className="flex flex-wrap justify-center gap-2">{LINKS.filter(([k]) => k !== slug).map(([k, l, h]) => <Link key={k} href={h} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-navy-800 transition hover:border-navy-700">{l} →</Link>)}</nav>
    </div><Footer /></div>);
}
