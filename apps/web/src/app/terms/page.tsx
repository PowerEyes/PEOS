
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export const metadata = { title: "Terms of Service – Power Eyes Opticals" };
const TERMS = [
  { title:"Acceptance of Terms", body:"By using the Power Eyes Opticals website (powereyes.in) or purchasing from our stores, you agree to these Terms of Service. If you do not agree, please do not use our website." },
  { title:"Products and Pricing", body:"All product prices are displayed in Indian Rupees (₹) and are inclusive of GST unless stated otherwise. Prices are subject to change without notice. In the event of a pricing error, we reserve the right to cancel the order and refund the amount paid. Product images are for illustration — actual colour and dimensions may vary slightly." },
  { title:"Prescription Accuracy", body:"You are responsible for providing an accurate, current prescription. Power Eyes Opticals will manufacture lenses based on the prescription you provide. We are not liable for vision problems resulting from an inaccurate prescription supplied by the customer. Prescriptions must be issued by a registered optometrist or ophthalmologist and must be valid (within 2 years for glasses, 1 year for contact lenses)." },
  { title:"Orders and Payment", body:"Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order. Full payment is required at the time of online order placement. For high-value or custom orders, we may require an advance payment confirmation before beginning production." },
  { title:"Delivery", body:"Delivery timelines are estimates, not guarantees. Power Eyes Opticals is not responsible for delays caused by courier partners, natural events or circumstances beyond our control. Risk of damage or loss passes to the customer upon delivery confirmation." },
  { title:"Returns and Exchanges", body:"Unworn frames may be returned within 7 days of purchase with original bill and packaging. Prescription lenses are custom-made and cannot be returned unless there is a manufacturing defect. If the lenses do not match the prescription you provided, we will remake them within 30 days at no charge. Hygiene products (contact lenses, nose pads) are non-returnable once opened." },
  { title:"Intellectual Property", body:"All content on this website including text, images, logos, and design is the property of Power Eyes Opticals. You may not reproduce, copy or distribute any content without prior written permission." },
  { title:"Limitation of Liability", body:"Power Eyes Opticals is not liable for any indirect, incidental or consequential damages arising from the use of our products or website. Our liability is limited to the value of the order in question. This does not affect your statutory rights under the Consumer Protection Act 2019." },
  { title:"Governing Law", body:"These terms are governed by the laws of India. Any disputes arising from these terms or your use of our website shall be subject to the exclusive jurisdiction of courts in Chennai, Tamil Nadu." },
];
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span className="font-medium text-slate-700">Terms of Service</span>
      </div>
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-10 text-center">
        <h1 className="font-extrabold text-3xl">Terms of Service</h1>
        <p className="text-slate-300 mt-2">Last updated: January 2025</p>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-4">
        {TERMS.map(s=>(
          <div key={s.title} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
            <h2 className="font-bold text-base text-navy-900 mb-2">{s.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
          </div>))}
        <div className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600 text-center">
          <p>Questions? Contact us at powereyes.chennai@gmail.com or call 9840496404.</p>
          <p className="mt-1">Power Eyes Opticals, 1st Floor, Mogappair East, Chennai – 600037, Tamil Nadu, India.</p>
        </div>
      </div>
      <Footer/>
    </div>);
}

