
"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MapPin, Phone, Mail, MessageCircle, Store } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type Store = { id: string; name: string; address: string | null; phone: string | null; email: string | null; image: string | null };

export function ContactView({ stores: STORES, faqs: FAQS, hours, title, subtitle }: { stores: Store[]; faqs: { q: string; a: string }[]; hours: string; title: string; subtitle: string }) {
  const { whatsappNumber } = useSite();
  const [openFAQ, setOpenFAQ] = useState<number|null>(null);
  const [f, setF] = useState({name:"",email:"",phone:"",subject:"",msg:""});
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState("");

  function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const text = `Hello!\nName: ${f.name}\nPhone: ${f.phone}\nEmail: ${f.email}\nSubject: ${f.subject}\nMessage: ${f.msg}`;
    window.open(waHref(whatsappNumber, text),"_blank");
    setBusy(false); setOk("Your message was sent via WhatsApp!"); setF({name:"",email:"",phone:"",subject:"",msg:""});
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <nav className="border-b border-slate-100 bg-white px-6 py-2 hidden sm:flex gap-6 text-sm text-slate-600">
        {[{n:"Eyeglasses",h:"/eyeglasses"},{n:"Sunglasses",h:"/sunglasses"},{n:"Contact Lenses",h:"/contact-lenses"},{n:"Computer Glasses",h:"/computer-glasses"},{n:"Kids Eyewear",h:"/eyeglasses?gender=kids"},{n:"Lens & Coatings",h:"/lenses"},{n:"Offers",h:"/offers"},{n:"Eye Test",h:"/eye-test"},{n:"About Us",h:"/about"}].map(({n,h})=><Link key={n} href={h} className="whitespace-nowrap hover:text-navy-900">{n}</Link>)}
      </nav>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">Home › <span className="font-medium text-slate-700">Contact & Support</span></div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-5xl"><h1 className="font-extrabold text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 text-slate-300 text-lg">{subtitle || "We're here for you and your family's vision care."}</p></div>
        <div className="absolute right-8 top-6 hidden sm:block text-right opacity-50" style={{fontFamily:"cursive",fontSize:"18px",lineHeight:1.5,fontWeight:"bold",color:"white"}}>Your Questions<br/>Our Support<br/>Always ❤️</div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-10">
        {/* Contact methods */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {icon:"📞",t:"Call Us",l1:STORES[0]?.phone??"",l2:STORES[1]?.phone??"",l3:hours,href:`tel:${STORES[0]?.phone??""}`},
            {icon:"✉️",t:"Email Us",l1:STORES.find(x=>x.email)?.email??"",l2:"",l3:"We typically respond within 24 hours.",href:`mailto:${STORES.find(x=>x.email)?.email??""}`},
            {icon:"💬",t:"WhatsApp",l1:whatsappNumber.replace(/\D/g,"").slice(-10),l2:"",l3:"Quick support on WhatsApp for faster assistance.",href:waHref(whatsappNumber)},
            {icon:"🏪",t:"Visit Our Store",l1:STORES[0]?.address??STORES[0]?.name??"",l2:"",l3:hours,href:"/store-locator"},
          ].map(c=>(
            <a key={c.t} href={c.href} target={c.href.startsWith("http")?"_blank":undefined} className="block rounded-2xl bg-white border border-slate-100 shadow-sm p-5 hover:border-navy-300 hover:shadow-md transition">
              <div className="text-3xl mb-3">{c.icon}</div>
              <p className="font-bold text-navy-900 text-sm">{c.t}</p>
              <p className="text-sm text-slate-700 mt-1 font-medium">{c.l1}</p>
              {c.l2&&<p className="text-sm text-slate-700">{c.l2}</p>}
              <p className="text-xs text-slate-400 mt-1">{c.l3}</p>
              {c.href==="/store-locator"&&<Link href="/store-locator" className="mt-2 text-xs text-navy-700 font-semibold hover:underline block">View on Map →</Link>}
            </a>))}
        </div>

        {/* Message form + Stores */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
            <h2 className="font-bold text-xl text-navy-900 mb-1">Send Us a Message</h2>
            <p className="text-sm text-slate-500 mb-5">Have a question or need assistance? Fill out the form and our team will get back to you.</p>
            {ok&&<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 mb-4">✓ {ok}</div>}
            <form onSubmit={send} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Full Name *</span>
                  <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required placeholder="Enter your name" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
                <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Email Address *</span>
                  <input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required placeholder="Enter your email" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
                <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Phone Number *</span>
                  <input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required placeholder="Enter your phone number" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/></label>
                <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Subject *</span>
                  <select value={f.subject} onChange={e=>setF({...f,subject:e.target.value})} required className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700 text-slate-600">
                    <option value="">Select a subject</option>
                    <option>Order query</option><option>Prescription help</option><option>Eye test booking</option>
                    <option>Repair & service</option><option>Returns & exchange</option><option>Product inquiry</option><option>Other</option>
                  </select></label>
              </div>
              <label className="block"><span className="text-xs font-medium text-slate-600 mb-1 block">Message *</span>
                <textarea value={f.msg} onChange={e=>setF({...f,msg:e.target.value})} required rows={4} placeholder="Type your message here..." className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700 resize-none"/></label>
              <button disabled={busy} className="w-full rounded-lg bg-gold-500 py-3.5 text-sm font-bold text-white hover:bg-gold-600 transition disabled:opacity-60">{busy?"Sending…":"Send Message →"}</button>
            </form>
          </div>

          {/* Stores */}
          <div>
            <h2 className="font-bold text-xl text-navy-900 mb-1">Our Stores</h2>
            <p className="text-sm text-slate-500 mb-4">Visit us for a personalised experience, expert eye testing and a wide range of eyewear.</p>
            <div className="space-y-4">
              {STORES.map(s=>(
                <div key={s.name} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                  {/* Store photo placeholder */}
                  <div className="h-40 bg-gradient-to-br from-navy-100 to-navy-200 flex items-center justify-center text-4xl">{s.image ? <img src={s.image} alt={s.name} className="h-full w-full object-cover" loading="lazy"/> : "🏪"}</div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-navy-900">{s.name}</p>
                      <span className="rounded bg-navy-800 text-white text-[10px] font-bold px-2 py-0.5">{STORES[0]?.id===s.id?"Main Store":"Branch"}</span>
                    </div>
                    <p className="flex items-start gap-1.5 text-xs text-slate-600"><MapPin size={12} className="mt-0.5 shrink-0 text-gold-500"/>{s.address}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-1"><Phone size={12} className="text-gold-500"/>{s.phone}</p>
                    {s.email && <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5"><Mail size={12} className="text-gold-500"/>{s.email}</p>}
                    <p className="text-xs text-slate-500 mt-1">🕐 {hours}</p>
                    <div className="flex gap-2 mt-3">
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(`${s.name} ${s.address ?? ""}`)}`} rel="noopener noreferrer" target="_blank" className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-navy-800 py-2.5 text-xs font-semibold text-white hover:bg-navy-700 transition"><MapPin size={12}/>Get Directions</a>
                      <a href={`tel:${s.phone}`} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-navy-800 py-2.5 text-xs font-semibold text-navy-800 hover:bg-navy-50 transition"><Phone size={12}/>Call Store</a>
                    </div>
                  </div>
                </div>))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div><h2 className="font-bold text-xl text-navy-900">Frequently Asked Questions</h2>
              <p className="text-sm text-slate-500">Find quick answers to common questions. Need more help? Contact us anytime.</p></div>
            <Link href="/faq" className="text-sm font-semibold text-navy-700 hover:underline whitespace-nowrap">View All FAQs →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FAQS.map((faq,i)=>(
              <div key={i} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <button onClick={()=>setOpenFAQ(openFAQ===i?null:i)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold text-navy-900 hover:bg-slate-50 transition">
                  {faq.q}
                  {openFAQ===i ? <ChevronUp size={16} className="shrink-0 text-slate-400"/> : <ChevronDown size={16} className="shrink-0 text-slate-400"/>}
                </button>
                {openFAQ===i&&<div className="border-t border-slate-100 p-4 text-sm text-slate-600">{faq.a}</div>}
              </div>))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-6">
          {[["🎧","Friendly Support","We're always here to help"],["🛡️","Trusted Service","Your satisfaction matters"],["⚡","Quick Response","Get help when you need it"],["❤️","Your Family's Vision Partner","Since 1998"]].map(([e,t,s])=>(
            <div key={t as string} className="flex items-center gap-2 text-sm"><span className="text-xl">{e}</span><div><p className="font-semibold text-navy-900">{t}</p><p className="text-xs text-slate-500">{s}</p></div></div>))}
        </div>

        {/* CTA banners */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-7 text-white">
            <h3 className="font-bold text-xl">BOOK AN EYE TEST TODAY</h3>
            <p className="text-slate-300 text-sm mt-1">Accurate results. Expert guidance. For the whole family.</p>
            <Link href="/eye-test" className="mt-4 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-navy-900 hover:bg-slate-100 transition">Book Now →</Link>
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-amber-600 to-gold-500 p-7 text-white">
            <h3 className="font-bold text-xl">EXPLORE OUR LATEST COLLECTION</h3>
            <p className="text-white/80 text-sm mt-1">Trendy frames. Premium brands. For every style and age.</p>
            <Link href="/eyeglasses" className="mt-4 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-navy-900 hover:bg-slate-100 transition">Shop Eyewear →</Link>
          </div>
        </div>
      </div>

      <Footer/>
    </div>
  );
}

