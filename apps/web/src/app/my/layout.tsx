import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { PortalNav } from "@/components/PortalNav";
import { LogOut } from "lucide-react";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/my/login");
  const { data: customer } = await sb.from("customers")
    .select("full_name, email, phone")
    .eq("auth_user_id", user.id).maybeSingle();
  const name = customer?.full_name || user.email?.split("@")[0] || "Customer";
  const initial = name[0]?.toUpperCase() || "C";
  return (<div className="min-h-screen bg-slate-50"><a href="#portal-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to account content</a><Header portal />
    <div className="mx-auto max-w-7xl flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-white border-r border-slate-100 h-[calc(100vh-130px)] sticky top-[130px]">
        {/* Profile card — lives here so the account shell is rendered exactly once */}
        <div className="shrink-0 border-b border-slate-100 p-4 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-navy-800 flex items-center justify-center text-xl font-bold text-white mb-2">{initial}</div>
          <p className="font-bold text-navy-900 text-sm truncate">{name}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{customer?.email || user.email}</p>
          {customer?.phone && <p className="text-xs text-slate-500">+91 {customer.phone}</p>}
          <Link href="/my/profile" className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:border-navy-700 hover:text-navy-800 transition">✏️ Edit Profile</Link>
        </div>
        <PortalNav />
        <div className="p-4 border-t border-slate-100 space-y-2">
          <form action="/api/logout" method="POST"><button className="flex w-full items-center gap-2 px-5 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition"><LogOut size={15}/>Sign out</button></form>
          <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-4 text-white"><p className="font-display text-sm font-bold">Your Family's<br/>Vision Partner</p><p className="mt-1 text-slate-400 text-[10px]">Since 1998</p></div>
        </div>
      </aside>
      <main id="portal-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 min-w-0">
        {/* Mobile & Tablet Secondary Portal Navigation Bar (< lg) */}
        <div className="lg:hidden -mx-4 -mt-4 mb-4 sm:-mx-6 sm:-mt-6 sm:mb-6 border-b border-slate-200 bg-white px-3 sm:px-4 py-2.5 shadow-sm print:hidden"><PortalNav mobile /></div>
        {children}
      </main>
    </div>
  </div>);
}
