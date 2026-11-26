"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { crumbsFor } from "@/lib/nav";
export function Breadcrumbs() {
  const c = crumbsFor(usePathname());
  return (<nav aria-label="Breadcrumb" className="min-w-0"><ol className="flex items-center gap-1 text-xs text-slate-500">
    {c.map((x, i) => (<li key={i} className="flex min-w-0 items-center gap-1">{i > 0 && <ChevronRight size={12} className="shrink-0 text-slate-300" />}
      {x.href ? <Link href={x.href} className="truncate hover:text-slate-800">{x.label}</Link> : <span className={`truncate ${i === c.length - 1 ? "font-semibold text-slate-800" : ""}`} aria-current={i === c.length - 1 ? "page" : undefined}>{x.label}</span>}</li>))}
  </ol></nav>);
}
