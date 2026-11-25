import type { ReactNode } from "react";
export function PortalPageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string }) {
  return <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[.12em] text-gold-700">{eyebrow || "My Power Eyes"}</p>
      <h1 className="font-display text-2xl font-bold leading-tight text-navy-900 sm:text-3xl">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
    </div>{action && <div className="shrink-0">{action}</div>}
  </header>;
}
