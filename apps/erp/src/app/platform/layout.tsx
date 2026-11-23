// Platform Super Admin layout — separate authorization scope from company tenants.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlatformUser, requirePlatform, type PlatformUser } from "@/lib/platform-guard";
import { supabaseServer } from "@/lib/supabase/server";

const NAV = [
  { label: "Overview", href: "/platform" },
  { label: "Companies", href: "/platform/companies" },
  { label: "Plans", href: "/platform/plans" },
  { label: "Subscriptions", href: "/platform/subscriptions" },
  { label: "Billing", href: "/platform/billing" },
  { label: "Administration", href: "/platform/admin" },
  { label: "Support", href: "/platform/support" },
];

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const pu = await requirePlatform(); // redirects to "/" if not a platform admin
  const superAdmin = pu.platform_role === "super_admin";
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-500 text-sm font-bold text-slate-950">P</span>
          <div>
            <p className="text-sm font-bold leading-tight">PowerOS</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Platform Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded-lg px-3 py-2 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3 text-xs text-slate-500">
          <p className="truncate">{pu.email}</p>
          <p className="mt-1 capitalize">{pu.platform_role.replace("_", " ")}</p>
          <Link href="/" className="mt-2 block text-gold-500 hover:underline">← Company app</Link>
          <form action="/api/logout" method="POST" className="mt-2">
            <button className="text-rose-400 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 px-6">
          <div className="flex items-center gap-2 md:hidden">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-500 text-xs font-bold text-slate-950">P</span>
            <span className="text-sm font-semibold">Platform</span>
          </div>
          <h1 className="text-sm font-medium text-slate-400">SaaS control centre</h1>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {superAdmin ? "Super Admin" : pu.platform_role}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
