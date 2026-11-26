import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export default function NotFound() {
  return (<div className="min-h-screen bg-white"><Header/>
    <div className="mx-auto max-w-lg px-4 py-32 text-center">
      <div className="text-7xl mb-4">👓</div>
      <h1 className="font-display text-5xl font-bold text-navy-900">404</h1>
      <p className="mt-3 text-xl text-slate-500">Page not found</p>
      <p className="mt-1 text-slate-400">This page doesn't exist or has been moved.</p>
      <div className="mt-8 flex justify-center gap-3"><Link href="/" className="btn-gold">Go home</Link><Link href="/eyeglasses" className="btn-navy">Shop eyewear</Link></div>
    </div>
    <Footer/></div>);
}
