
import Link from "next/link";
import { getSiteSettings } from "@/lib/site";
import { waHref } from "@/lib/wa";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export const metadata = { title: "Returns & Exchange – Power Eyes Opticals" };
export default async function ReturnsPage() {
  const site = await getSiteSettings();
  const POLICY = [
    { e:"✅", t:"Frames — 7 Day Return", items:["Unworn and undamaged frames only","Original bill and packaging required","Return to any Power Eyes store in person","Full refund to original payment method within 5–7 business days","Exchange for a different frame of equal or higher value (pay difference)"] },
    { e:"🔭", t:"Prescription Lenses — Not Returnable", items:["Prescription lenses are custom-made for your eyes and cannot be returned","If lenses do not match the prescription you provided, we will remake them free within 30 days","If there is a manufacturing defect (coating peeling, incorrect power), we replace at no charge","Power correction: if you return for a power change within 30 days and your Rx was issued by us, lenses are remade free"] },
    { e:"🔵", t:"Contact Lenses — No Return Once Opened", items:["Sealed, unopened boxes may be exchanged within 7 days","Once the box is opened, contact lenses cannot be returned for hygiene reasons","Defective lenses (torn, damaged inside sealed pack) will be replaced"] },
    { e:"📦", t:"Online Orders — Return Process", items:["Log in to My Account → My Orders → select order → Request Return (coming soon)","Or WhatsApp us on 9840496404 with your order number","We will arrange courier pickup from your address for orders above ₹2,000","For smaller orders, you can return to either store directly","Refund processed within 5–7 business days after we receive and inspect the item"] },
  ];
  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span className="font-medium text-slate-700">Returns & Exchange</span>
      </div>
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-10 text-center">
        <h1 className="font-extrabold text-3xl">Returns & Exchange</h1>
        <p className="text-slate-300 mt-2">Simple, hassle-free returns — because your satisfaction matters.</p>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center">
          <p className="font-bold text-emerald-800 text-lg">7-Day Easy Returns on Frames</p>
          <p className="text-emerald-700 text-sm mt-1">Return unworn frames within 7 days for a full refund — no questions asked.</p>
        </div>
        {POLICY.map(p=>(
          <div key={p.t} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
            <h2 className="font-bold text-navy-900 text-lg mb-3 flex items-center gap-2"><span>{p.e}</span>{p.t}</h2>
            <ul className="space-y-2">{p.items.map((item,i)=>(
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600"><span className="text-slate-400 mt-0.5 shrink-0">•</span>{item}</li>))}</ul>
          </div>))}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-navy-900 mb-3">What's NOT Covered</h2>
          <ul className="space-y-2">{["Accidental damage, scratches, breakage after delivery","Frames with signs of wear or alteration","Items returned after 7 days (unless manufacturing defect)","Customised or engraved products","Prescription lenses (custom-made for your eyes)","Opened contact lens boxes"].map((i,n)=>(
            <li key={n} className="flex items-start gap-2 text-sm text-slate-600"><span className="text-rose-500 mt-0.5 shrink-0">✗</span>{i}</li>))}</ul>
        </div>
        <div className="rounded-2xl bg-gold-50 border border-gold-100 p-5 text-center">
          <p className="font-bold text-navy-900">Need to return something?</p>
          <p className="text-sm text-slate-600 mt-1">Contact us and we'll make it easy.</p>
          <div className="flex justify-center gap-3 mt-3 flex-wrap">
            <a href={waHref(site.whatsappNumber, "I need to return an item")} target="_blank" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">💬 WhatsApp Us</a>
            <a href="tel:9840496404" className="rounded-lg border border-navy-800 px-5 py-2.5 text-sm font-bold text-navy-800">📞 Call 9840496404</a>
          </div>
        </div>
      </div>
      <Footer/>
    </div>);
}

