
"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function FAQPage() {
  const { whatsappNumber } = useSite();
  const [open, setOpen] = useState<string|null>(null);
  const toggle = (k: string) => setOpen(o => o===k ? null : k);

  const SECTIONS = [
    { title:"Eye Testing", items:[
      { q:"Is the eye test free?", a:"Yes. A comprehensive eye test at both our Mogappair stores is completely free, with no obligation to purchase. We use digital auto-refractors for accurate results." },
      { q:"How long does an eye test take?", a:"A standard comprehensive eye test takes 20–30 minutes. Contact lens fittings and children's tests may take slightly longer." },
      { q:"How often should I get my eyes tested?", a:"Adults with no known issues: every 2 years. Children: annually. If you wear glasses or contact lenses, or have a family history of eye disease, annually is recommended." },
      { q:"Can I bring my existing prescription from another clinic?", a:"Yes. We accept valid prescriptions from any registered ophthalmologist or optometrist. The prescription must be less than 2 years old for glasses and 1 year old for contact lenses." },
      { q:"Do you test children's eyes?", a:"Yes. We offer specialist children's eye tests (below 16 years) free of charge. We recommend first eye test at age 3–4, then annually through school years." },
    ]},
    { title:"Ordering & Delivery", items:[
      { q:"How long does it take to get my glasses ready?", a:"Single vision glasses: 2–3 working days. Progressive / bifocal lenses: 5–7 working days. High-power prescriptions may take longer. You'll receive a WhatsApp message when ready." },
      { q:"Do you offer home delivery?", a:"Yes. We deliver across Chennai and major Indian cities. Free shipping on orders above ₹999. Express delivery (1–2 days) is available for ₹99." },
      { q:"Can I pick up from the store?", a:"Yes. Store pickup is always free. Choose 'Store Pickup' at checkout and select your preferred store (Mogappair East or Mogappair West). We'll WhatsApp you when your order is ready." },
      { q:"Can I order glasses online with my prescription?", a:"Yes. Upload a photo of your prescription during checkout, or enter values manually. Our optometrist reviews every prescription before the order goes to the lab." },
    ]},
    { title:"Products & Lenses", items:[
      { q:"Are all products genuine?", a:"Yes. 100% of products sold at Power Eyes Opticals are purchased from authorised distributors. We do not sell grey market, parallel import or counterfeit products." },
      { q:"What lens index should I choose?", a:"Our lens recommendation engine selects the right index based on your prescription. As a guide: mild powers (up to ±2D) use 1.56 standard; moderate (±2–4D) use 1.60; high (±4–6D) use 1.67; very high (above ±6D) use 1.74." },
      { q:"Do you offer progressive lenses?", a:"Yes. We offer single vision, progressive, bifocal and occupational lenses. Progressive lenses are available from ₹3,990 with anti-reflective coating included." },
      { q:"Can I add blue light filtering to any lens?", a:"Yes. Blue light filter is available as an add-on for all lens packages. We recommend it for customers who spend 4+ hours daily on screens." },
      { q:"Do you sell contact lenses?", a:"Yes. We stock daily, monthly, toric and coloured contact lenses from brands including Alcon, Johnson & Johnson and Bausch & Lomb. A contact lens fitting is required for first-time wearers." },
    ]},
    { title:"Returns & Warranty", items:[
      { q:"What is your return policy?", a:"You can return or exchange unworn frames within 7 days of purchase with the original bill. Prescription lenses cannot be returned unless there is a manufacturing defect. If your prescription was wrong, we will remake the lenses free of charge within 30 days." },
      { q:"What does the warranty cover?", a:"All frames come with a 1-year manufacturing warranty covering defects in material and workmanship — hinge failures, coating peeling and nose pad defects. It does not cover accidental damage, scratches from normal use or lost frames." },
      { q:"What if my lenses are scratched?", a:"We offer free adjustments for life on all frames purchased from us. Scratched lenses can be replaced at a discount — bring your original frame and prescription to any store." },
    ]},
    { title:"Payments", items:[
      { q:"What payment methods do you accept?", a:"Online: UPI (Google Pay, PhonePe, Paytm), Credit/Debit Card, Net Banking via Razorpay. In-store: Cash, UPI, card. We also accept partial advance payment for prescription lens orders." },
      { q:"Is online payment secure?", a:"Yes. All online payments are processed through Razorpay, which is PCI-DSS Level 1 compliant. We never store your card details." },
    ]},
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span className="font-medium text-slate-700">FAQs</span>
      </div>

      <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-12 text-center">
        <h1 className="font-extrabold text-3xl">Frequently Asked Questions</h1>
        <p className="text-slate-300 mt-2">Everything you need to know about Power Eyes Opticals.</p>
        <p className="mt-3 text-sm text-slate-400">Can't find your answer? <a href={waHref(whatsappNumber)} target="_blank" className="text-gold-400 hover:underline">Chat with us on WhatsApp →</a></p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-8">
        {SECTIONS.map(sec => (
          <div key={sec.title}>
            <h2 className="font-bold text-lg text-navy-900 mb-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-slate-200"/>
              <span className="shrink-0">{sec.title}</span>
              <span className="h-px flex-1 bg-slate-200"/>
            </h2>
            <div className="space-y-2">
              {sec.items.map(item => {
                const k = `${sec.title}-${item.q}`;
                return (
                  <div key={k} className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                    <button onClick={()=>toggle(k)} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-navy-900 hover:bg-slate-50 transition">
                      {item.q}
                      {open===k ? <ChevronUp size={16} className="shrink-0 text-slate-400"/> : <ChevronDown size={16} className="shrink-0 text-slate-400"/>}
                    </button>
                    {open===k && <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-50">{item.a}</div>}
                  </div>);})}
            </div>
          </div>))}

        <div className="rounded-2xl bg-navy-50 border border-navy-100 p-6 text-center">
          <p className="font-bold text-navy-900">Still have a question?</p>
          <p className="text-sm text-slate-600 mt-1">Our team is available Mon–Sun 10 AM – 9 PM.</p>
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            <a href={waHref(whatsappNumber)} target="_blank" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">💬 WhatsApp</a>
            <a href="tel:9840496404" className="rounded-lg border border-navy-800 px-5 py-2.5 text-sm font-bold text-navy-800 hover:bg-navy-50">📞 Call Us</a>
            <Link href="/contact" className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-white">Contact Form</Link>
          </div>
        </div>
      </div>
      <Footer/>
    </div>);
}

