"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_NAV } from "@/lib/portal-nav";

function isActive(path: string, href: string) {
  return path === href || (href !== "/my" && path.startsWith(`${href}/`));
}
export function PortalNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname() || "/my";
  return <nav aria-label="Customer account navigation" className={mobile ? "flex gap-2 overflow-x-auto overscroll-x-contain py-1" : "flex-1 min-h-0 py-3 overflow-y-auto"}>
    {PORTAL_NAV.map(({ href, label, icon: Icon }) => {
      const active = isActive(pathname, href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={mobile
          ? `flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 ${active ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-navy-700 hover:bg-navy-50"}`
          : `flex min-h-11 items-center gap-3 px-5 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-navy-700 ${active ? "border-r-2 border-navy-800 bg-navy-50 font-semibold text-navy-900" : "text-slate-600 hover:bg-navy-50 hover:text-navy-900"}`}>
        <Icon size={mobile ? 14 : 15} className="shrink-0"/><span>{label}</span>
      </Link>;
    })}
  </nav>;
}
