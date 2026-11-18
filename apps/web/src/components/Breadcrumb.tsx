import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/**
 * Linked breadcrumb trail — Home › Eyeglasses › Ray-Ban › Wayfarer Classic.
 *
 * `strip` renders the full-width bar (listing / content pages); `inline`
 * renders just the row so pages can place it inside their own container.
 */
export function Breadcrumb({ items, strip = false }: { items: Crumb[]; strip?: boolean }) {
  const row = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <Link href="/" className="transition hover:text-navy-800 hover:underline">Home</Link>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight size={11} className="shrink-0 text-slate-300" />
            {c.href && !last ? (
              <Link href={c.href} className="transition hover:text-navy-800 hover:underline">{c.label}</Link>
            ) : (
              <span className={`truncate ${last ? "font-medium text-navy-800" : ""}`}>{c.label}</span>
            )}
          </span>);
      })}
    </div>);

  if (!strip) return row;
  return (
    <nav aria-label="Breadcrumb" className="border-b border-slate-100 bg-white px-4 py-2.5 sm:px-6">
      <div className="mx-auto max-w-7xl">{row}</div>
    </nav>);
}
