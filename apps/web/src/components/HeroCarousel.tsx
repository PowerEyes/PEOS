"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type HeroSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  ctaLabel?: string | null;
  ctaLink?: string | null;
  cta2Label?: string | null;
  cta2Link?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  bg?: string | null;
  icon?: string | null;
  features?: { icon?: string | null; title?: string | null }[] | null;
  badgeTitle?: string | null;
  badgeSubtitle?: string | null;
};

function Lines({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <>
      {String(text)
        .split(/\r?\n/)
        .map((seg, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {seg}
          </Fragment>
        ))}
    </>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const safeSlides = slides.length ? slides : [{ id: "hero-empty", title: "Your Family's Vision Partner" }];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        });
      },
      { root, threshold: [0.6] },
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [safeSlides.length]);

  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      const root = scrollerRef.current;
      if (!root) return;
      const i = ((index % safeSlides.length) + safeSlides.length) % safeSlides.length;
      root.scrollTo({
        left: i * root.clientWidth,
        behavior: smooth && !reducedMotion ? "smooth" : "auto",
      });
      setActive(i);
    },
    [safeSlides.length, reducedMotion],
  );

  useEffect(() => {
    if (safeSlides.length <= 1) return;
    const id = window.setInterval(() => {
      if (paused || document.hidden || reducedMotion) return;
      setActive((prev) => {
        const next = (prev + 1) % safeSlides.length;
        const root = scrollerRef.current;
        if (root) {
          root.scrollTo({
            left: next * root.clientWidth,
            behavior: reducedMotion ? "auto" : "smooth",
          });
        }
        return next;
      });
    }, 6000);
    return () => window.clearInterval(id);
  }, [safeSlides.length, paused, reducedMotion]);

  const pauseFor = useCallback((ms: number) => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), ms);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollToIndex(active + 1);
        pauseFor(8000);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToIndex(active - 1);
        pauseFor(8000);
      }
    },
    [active, scrollToIndex, pauseFor],
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Homepage hero"
      className="relative w-full overflow-hidden bg-navy-900"
    >
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={() => pauseFor(8000)}
        className={`flex h-[88vh] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          reducedMotion ? "" : "scroll-smooth"
        }`}
      >
        {safeSlides.map((slide, i) => {
          const gradient = slide.bg ? `bg-gradient-to-br ${slide.bg}` : "bg-gradient-to-br from-navy-800 via-slate-800 to-navy-900";
          return (
            <div
              key={slide.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-index={i}
              aria-hidden={i !== active}
              className="relative min-w-full snap-start"
            >
              {slide.image ? (
                <Image
                  src={slide.image}
                  alt={slide.imageAlt || slide.title || ""}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              ) : (
                <div className={`absolute inset-0 ${gradient} opacity-80`} />
              )}
              {slide.image && (
                <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/70 to-transparent z-10" />
              )}
              {!slide.image && (
                <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/70 to-transparent z-10" />
              )}

              <div className="relative z-20 mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8 py-20">
                <div className="max-w-2xl text-white space-y-6 animate-slide-up">
                  {slide.badge && (
                    <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase">
                      {slide.badge}
                    </p>
                  )}
                  <h1 className="font-display text-5xl sm:text-6xl font-bold leading-tight">
                    <Lines text={slide.title} />
                  </h1>
                  {slide.subtitle && (
                    <p className="text-xl text-slate-300">
                      <Lines text={slide.subtitle} />
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {slide.ctaLabel && (
                      <Link
                        href={slide.ctaLink || "#"}
                        className="btn-gold text-base px-8 py-4"
                      >
                        {slide.ctaLabel}
                      </Link>
                    )}
                    {slide.cta2Label && (
                      <Link
                        href={slide.cta2Link || "#"}
                        className="btn-outline text-base px-8 py-4"
                      >
                        {slide.cta2Label}
                      </Link>
                    )}
                  </div>
                  {slide.features && slide.features.length > 0 && (
                    <div className="flex flex-wrap gap-6 pt-4 text-sm text-slate-400">
                      {slide.features.map((f, n) => (
                        <span key={f.title || n} className="flex items-center gap-2">
                          {f.icon} {f.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {slide.badgeTitle && (
                <div className="absolute right-0 bottom-6 z-20 text-center px-6 hidden sm:block">
                  <div className="inline-block rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-4 text-white text-right">
                    <p className="font-display text-2xl font-bold italic">
                      {slide.badgeTitle}
                      <br />
                      {slide.badgeSubtitle}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {safeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => {
              scrollToIndex(active - 1);
              pauseFor(8000);
            }}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 sm:flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              scrollToIndex(active + 1);
              pauseFor(8000);
            }}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 sm:flex"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2">
            {safeSlides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  scrollToIndex(i);
                  pauseFor(8000);
                }}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active}
                className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/70 ${
                  i === active ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
