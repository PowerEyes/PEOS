import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT, ERP_URL } from "@/lib/env";
export const metadata: Metadata = { title: { default: `${PRODUCT} — software for optical retail`, template: `%s · ${PRODUCT}` }, description: "Run billing, prescriptions, lab, inventory and your website for one or many optical stores." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>
    <header className="border-b"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <Link href="/" className="text-lg font-semibold">{PRODUCT}</Link>
      <nav className="flex items-center gap-5 text-sm"><Link href="/pricing">Pricing</Link><Link href="/contact">Contact</Link>{ERP_URL && <a href={`${ERP_URL}/login`}>Sign in</a>}<Link href="/contact" className="btn">Get started</Link></nav></div></header>
    <main>{children}</main>
    <footer className="mt-16 border-t py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} {PRODUCT}</footer>
  </body></html>);
}
