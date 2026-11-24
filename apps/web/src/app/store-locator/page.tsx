import { supabasePublic } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { MapPin, Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
export const metadata = { title: "Store Locator – Power Eyes Mogappair" };

const branchImgUrl = (p: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${p}`;
/** Only embed URLs that passed the ERP's validator are rendered (https + *.google.com + /maps). */
const safeMap = (m: unknown): string => {
  try {
    const u = new URL(String(m));
    return u.protocol === "https:" && /(^|\.)google\.com$/.test(u.hostname) && u.pathname.startsWith("/maps") ? u.toString() : "";
  } catch { return ""; }
};
const WEEK:[string,string][]=[["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]];
const showHours=(hours:any)=>WEEK.map(([key,label])=>{const h=hours?.[key];if(!h)return null;return `${label} ${h.closed?"Closed":`${h.open}–${h.close}`}`;}).filter(Boolean).join(" · ");
export default async function Page() {
  const site = await getSiteSettings();
  const { data: branches } = await supabasePublic().from("branches").select("*").eq("is_active",true).order("name");
  return (<div className="min-h-screen bg-white"><Header/>
    <div className="bg-gradient-to-r from-navy-900 to-navy-800 py-14 px-4 text-center text-white">
      <h1 className="font-display text-4xl font-bold">Find a Store</h1>
      <p className="mt-2 text-slate-300">Visit us for eye tests, expert advice and a wide range of eyewear</p>
    </div>
    <div className="mx-auto max-w-4xl section-pad px-4 grid gap-6 sm:grid-cols-2">
      {(branches??[]).map((b:any)=>(
          <div key={b.id} className="card p-6 space-y-4">
            {b.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branchImgUrl(b.image_path)} alt={b.image_alt || b.name} loading="lazy"
                className="h-40 w-full rounded-xl object-cover" />
            ) : (
              <div className="h-40 rounded-xl bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-5xl">🏪</div>
            )}
            <div><h2 className="font-display text-xl font-bold text-navy-900">{b.name}</h2>
              <p className="flex items-start gap-2 text-sm text-slate-600 mt-2"><MapPin size={14} className="mt-0.5 shrink-0 text-gold-500"/>{b.address}</p>
              <p className="flex items-center gap-2 text-sm text-slate-600 mt-1"><Phone size={14} className="text-gold-500"/>{b.phone}</p>
              {b.email&&<p className="flex items-center gap-2 text-sm text-slate-600 mt-1"><Mail size={14} className="text-gold-500"/>{b.email}</p>}
              {showHours(b.opening_hours)&&<p className="flex items-start gap-2 text-sm text-slate-600 mt-1"><Clock size={14} className="mt-0.5 text-gold-500"/>{showHours(b.opening_hours)}</p>}</div>
            {safeMap(b.map_embed) && (
              <iframe src={safeMap(b.map_embed)} title={`Map — ${b.name}`} loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-48 w-full rounded-xl border border-slate-200" />
            )}
          <div className="flex gap-2">
            <a href={`https://maps.google.com/?q=${encodeURIComponent(b.address ?? "")}`} target="_blank" className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2.5 text-sm font-medium hover:border-navy-700 transition"><MapPin size={14}/>Directions</a>
            <a href={waHref(site.whatsappNumber, `Hello, I'm at ${b.name}`)} target="_blank" className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-emerald-200 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition"><MessageCircle size={14}/>WhatsApp</a>
          </div>
          <Link href="/eye-test" className="btn-gold w-full text-sm">Book Eye Test at this Store</Link>
        </div>))}
    </div>
    <Footer/></div>);
}
