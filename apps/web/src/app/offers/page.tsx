import { getOrgId } from "@/lib/tenant";

import { supabasePublic } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title:"Current Offers & Deals",
  description:"Latest discounts, coupon codes and promotions at our stores and online. Eyeglasses, sunglasses, contact lenses and lens upgrades.",
};
export const revalidate = 60;

function daysLeft(until: string | null): string | null {
  if (!until) return null;
  const d = Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
  if (d <= 0) return null;
  if (d === 1) return "Last day!";
  if (d <= 7) return `${d} days left`;
  return null;
}

export default async function OffersPage() {
  const site = await getSiteSettings();
  const sb = supabasePublic();
  const orgId = await getOrgId();
  const [offersRes, couponsRes] = await Promise.all([
    sb.from("offers").select("*").eq("org_id", orgId).order("display_order").order("created_at",{ascending:false}),
    sb.from("coupons").select("code,description,type,value,min_order,valid_until").eq("org_id", orgId)
      .eq("is_active",true).order("value",{ascending:false}).limit(8),
  ]);
  const offers  = offersRes.data  ?? [];
  const coupons = couponsRes.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span className="font-medium text-slate-700">Offers</span>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-gold-500 to-gold-600 text-white px-6 py-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold mb-3">🎉 Latest Deals</div>
        <h1 className="font-extrabold text-4xl sm:text-5xl">Current Offers</h1>
        <p className="mt-3 text-white/80 text-lg">Exclusive discounts on eyeglasses, sunglasses, lenses and eye care.</p>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-10">
        {/* Offer cards */}
        {offers.length > 0 ? (
          <div>
            <h2 className="font-bold text-2xl text-navy-900 mb-5">Current Promotions</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {offers.map((o:any) => {
                const dl = daysLeft(o.valid_until);
                return (
                  <div key={o.id} className="rounded-2xl overflow-hidden shadow-sm"
                    style={{ background: o.bg_color ?? "#0B1B36", color: o.text_color ?? "#FFFFFF" }}>
                    <div className="p-7 relative overflow-hidden">
                      {o.badge && (
                        <span className="absolute right-5 top-5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-bold">
                          {o.badge}
                        </span>)}
                      {dl && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white mb-2">
                          ⏰ {dl}
                        </span>)}
                      <h3 className="font-extrabold text-2xl leading-tight">{o.title}</h3>
                      {o.subtitle && <p className="text-sm opacity-80 mt-1 font-medium">{o.subtitle}</p>}
                      {o.description && <p className="text-xs opacity-70 mt-2 leading-relaxed">{o.description}</p>}
                      {o.coupon_code && (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-white/40 bg-white/10 px-4 py-2">
                          <span className="text-xs opacity-70">Code:</span>
                          <span className="font-mono font-extrabold text-lg tracking-widest">{o.coupon_code}</span>
                        </div>)}
                      <div className="mt-5">
                        <Link href={o.cta_href ?? "/eyeglasses"}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-5 py-2.5 text-sm font-bold hover:bg-white transition"
                          style={{ color: o.bg_color ?? "#0B1B36" }}>
                          {o.cta_label ?? "Shop Now →"}
                        </Link>
                      </div>
                      {o.valid_until && !dl && (
                        <p className="text-xs opacity-50 mt-3">Valid until {new Date(o.valid_until).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>)}
                    </div>
                  </div>);})}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-100 p-16 text-center">
            <p className="text-3xl mb-3">🎁</p>
            <p className="font-semibold text-slate-600">No active promotions right now</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Check back soon or follow us on Instagram for the latest deals.</p>
            <Link href="/eyeglasses" className="inline-flex rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700">Browse All Frames</Link>
          </div>)}

        {/* Active coupon codes */}
        {coupons.length > 0 && (
          <div>
            <h2 className="font-bold text-2xl text-navy-900 mb-2">Active Coupon Codes</h2>
            <p className="text-sm text-slate-500 mb-5">Enter these codes at checkout to apply the discount.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {coupons.map((c:any) => (
                <div key={c.code} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-4">
                  <div className="rounded-xl bg-gold-50 border-2 border-dashed border-gold-300 px-4 py-2.5 text-center min-w-[100px]">
                    <p className="font-mono font-extrabold text-base tracking-wider text-gold-700">{c.code}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy-900">
                      {c.type==="percent" ? `${c.value}% off` : `₹${c.value} off`}
                      {c.min_order > 0 && <span className="text-xs text-slate-400 ml-1">above ₹{Number(c.min_order).toLocaleString("en-IN")}</span>}
                    </p>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                    {c.valid_until && <p className="text-[11px] text-slate-400 mt-0.5">Valid until {new Date(c.valid_until).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>}
                  </div>
                  <Link href="/eyeglasses" className="shrink-0 rounded-lg bg-navy-800 px-3 py-2 text-xs font-bold text-white hover:bg-navy-700 transition">Use →</Link>
                </div>))}
            </div>
          </div>)}

        {/* Always-on offers */}
        <div>
          <h2 className="font-bold text-2xl text-navy-900 mb-5">Always Available</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { e:"👁️", t:"Free Eye Test",        d:"Comprehensive eye test free at our stores. No appointment needed.", href:"/eye-test", cta:"Book Now" },
              { e:"🔧", t:"Free Adjustments",     d:"Free frame adjustments and nose pad replacements for life on all frames purchased from us.", href:"/store-locator", cta:"Visit Store" },
              { e:"🛡️", t:"1-Year Warranty",      d:"Manufacturing warranty on all frames. Free replacement for defective products within 12 months.", href:"/returns", cta:"Learn More" },
              { e:"🚚", t:"Free Shipping",        d:"Free home delivery on all orders above ₹999 across India.", href:"/eyeglasses", cta:"Shop Now" },
              { e:"🔄", t:"Easy 7-Day Returns",   d:"Return unworn frames within 7 days with original bill. Full refund, no questions asked.", href:"/returns", cta:"Learn More" },
              { e:"👶", t:"Free Kids Eye Test",   d:"Specialised eye tests for children below 16 — completely free, with or without a purchase.", href:"/eye-test", cta:"Book Now" },
            ].map(item=>(
              <div key={item.t} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <span className="text-2xl">{item.e}</span>
                <p className="font-bold text-navy-900 mt-2 mb-1">{item.t}</p>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.d}</p>
                <Link href={item.href} className="text-xs font-semibold text-navy-700 hover:underline">{item.cta} →</Link>
              </div>))}
          </div>
        </div>

        {/* Newsletter / WhatsApp signup */}
        <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-8 text-white text-center">
          <h3 className="font-bold text-xl mb-2">Get Exclusive Offers on WhatsApp</h3>
          <p className="text-slate-300 text-sm mb-5">Be the first to know about new arrivals, flash sales and seasonal promotions.</p>
          <a href={waHref(site.whatsappNumber, "I want to receive your latest offers and updates")}
            target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 transition">
            💬 Subscribe on WhatsApp
          </a>
          <p className="text-slate-400 text-xs mt-3">Or create a free account to receive personalised offers.</p>
          <Link href="/my/login" className="mt-2 inline-block text-gold-400 text-sm hover:underline font-medium">Create Account →</Link>
        </div>
      </div>
      <Footer/>
    </div>);
}

