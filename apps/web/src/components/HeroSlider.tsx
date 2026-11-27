"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { safeHref } from "@/lib/href";

export type HeroSlide = {
  key?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  imageAlt?: string;
  videoUrl?: string | null;
  ctaLabel?: string;
  ctaLink?: string;
  cta2Label?: string;
  cta2Link?: string;
  features?: { icon?: string; title?: string }[];
  cornerTitle?: string;
  cornerSubtitle?: string;
};

/** CMS-authored hero. One row is a static banner; multiple active rows rotate. */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [slides.length]);
  const s = slides[index] ?? slides[0];
  if (!s) return null;
  return (
    <section className="relative min-h-[85vh] overflow-hidden bg-navy-900 flex items-center">
      <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/70 to-transparent z-10" />
      {s.videoUrl ? (
        <video src={s.videoUrl} autoPlay muted loop playsInline
          className="absolute inset-0 h-full w-full object-cover" aria-hidden />
      ) : s.image ? (
        <img src={s.image} alt={s.imageAlt || ""} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-navy-800 via-slate-800 to-navy-900 opacity-80" />
      )}
      <div className="relative z-20 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-6 text-white animate-slide-up">
          {s.badge && <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">{s.badge}</p>}
          <h1 className="font-display text-5xl font-bold leading-tight whitespace-pre-line sm:text-6xl">{s.title}</h1>
          {s.subtitle && <p className="whitespace-pre-line text-xl text-slate-300">{s.subtitle}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            {s.ctaLabel && <Link href={safeHref(s.ctaLink, "/eyeglasses")} className="btn-gold px-8 py-4 text-base">{s.ctaLabel}</Link>}
            {s.cta2Label && <Link href={safeHref(s.cta2Link, "/eye-test")} className="btn-outline px-8 py-4 text-base">{s.cta2Label}</Link>}
          </div>
          {!!s.features?.length && (
            <div className="flex flex-wrap gap-6 pt-4 text-sm text-slate-400">
              {s.features.map((f, n) => <span key={n} className="flex items-center gap-2">{f.icon} {f.title}</span>)}
            </div>
          )}
        </div>
      </div>
      {(s.cornerTitle || s.cornerSubtitle) && (
        <div className="absolute bottom-6 right-0 z-20 hidden px-6 text-center lg:block">
          <div className="inline-block rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-right text-white backdrop-blur-sm">
            <p className="font-display text-2xl font-bold italic">{s.cornerTitle}<br />{s.cornerSubtitle}</p>
          </div>
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Hero slides">
          {slides.map((slide, n) => (
            <button key={slide.key || n} type="button" aria-label={`Show slide ${n + 1}`}
              onClick={() => setIndex(n)}
              className={`h-2 rounded-full transition-all ${n === index ? "w-7 bg-gold-400" : "w-2 bg-white/50 hover:bg-white"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
