"use client";
import Link from "next/link";
import { Eye, Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";
import { useChrome } from "@/components/chrome";
import { DEFAULT_FOOTER, type FooterContact } from "@/lib/chrome-data";

// `icon` is the CMS string stored on each row; unknown values degrade to the
// first sensible glyph rather than rendering nothing.
const CONTACT_ICON: Record<string, typeof MapPin> = { map: MapPin, phone: Phone, mail: Mail };
const SOCIAL_ICON: Record<string, typeof Instagram> = { instagram: Instagram, facebook: Facebook, youtube: Youtube };

// NOTE: this used to be a Server Component. It cannot be async, because the
// `cart` and `checkout` pages are Client Components that import it directly —
// an async Server Component cannot be imported from a Client Component. It now
// reads chrome from the provider installed by the root layout instead, which
// also means Header and Footer share one fetch per request.
export function Footer() {
  const chrome = useChrome();
  // `null` = the operator hid the `footer` section; outside a provider = fall
  // back to the hardcoded footer so the site is never link-less.
  const f = chrome ? chrome.footer : DEFAULT_FOOTER;
  if (!f) return null;

  return (<footer className="bg-navy-900 text-slate-400">
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4"><Eye className="text-gold-400 h-7 w-7"/><div><span className="block font-display text-xl font-bold text-white">{f.brand.title}</span><span className="block text-[9px] tracking-widest text-slate-400">{f.brand.badge}</span></div></div>
          <p className="text-sm leading-relaxed">{f.brand.tagline}</p>
          <div className="mt-4 space-y-2 text-sm">
            {f.contact.map((c: FooterContact) => {
              const I = CONTACT_ICON[c.icon] ?? MapPin;
              const start = c.icon === "map";
              return (
                <p key={c.label} className={start ? "flex items-start gap-2" : "flex items-center gap-2"}>
                  <I size={14} className={start ? "mt-0.5 shrink-0 text-gold-400" : "text-gold-400"}/>
                  {c.href ? <a href={c.href}>{c.label}</a> : c.label}
                </p>);})}
          </div>
          <div className="mt-5 flex gap-3">{f.social.map((s: FooterContact) => {
            const I = SOCIAL_ICON[s.icon] ?? Instagram;
            return <a key={s.label} href={s.href} aria-label={s.label} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-gold-500 transition"><I size={16}/></a>;})}</div>
        </div>
        {f.columns.map(g => (
          <div key={g.title}><p className="mb-3 text-xs font-bold uppercase tracking-wider text-white">{g.title}</p>
            <ul className="space-y-2">{g.items.map(i => <li key={i.label}><Link href={i.href} className="text-sm hover:text-gold-400 transition">{i.label}</Link></li>)}</ul></div>))}
      </div>
      <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs sm:flex-row">
        <p>© {new Date().getFullYear()} {chrome?.storeName ?? "Power Eyes Opticals"}. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          {f.trust.map(t => <span key={t} className="flex items-center gap-1">✓ {t}</span>)}</div>
      </div>
    </div>
  </footer>);
}
