
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export const metadata = { title: "Privacy Policy – Power Eyes Opticals" };
const SECTIONS = [
  { title:"Information We Collect", body:`When you use the Power Eyes Opticals website or visit our stores, we collect information you provide directly: your name, phone number and email address when you create an account or place an order; your eye prescription (SPH, CYL, Axis, ADD, PD) when you upload a prescription or book a lens order; your delivery address when you choose home delivery; your payment method details, which are processed securely by Razorpay and never stored on our servers; and any messages you send us via our contact form or WhatsApp.\n\nWe also collect information automatically: pages visited, time spent on each page, browser type and device type through standard web analytics.` },
  { title:"How We Use Your Information", body:`We use your information to process and fulfil your orders, send order confirmations and status updates via WhatsApp and email, prepare your prescription lenses accurately and safely, communicate with you about appointments you book, send you information about offers and promotions if you have opted in, improve our website and services, and comply with legal obligations.\n\nYour prescription information is used only for fulfilling your lens order. It is shared with our lens laboratory partners only to the extent necessary to manufacture your lenses.` },
  { title:"Eye Prescription Data", body:`Your eye prescription is sensitive health information. We treat it with the highest level of care. Your prescription is stored securely in our database and is accessible only to you through your Vision ID and to our trained optometrists and dispensing staff.\n\nWe do not sell, rent or share your prescription data with any third party for marketing purposes. Our lab partners receive only the prescription values necessary to manufacture your lenses and are contractually required to delete that data after production.` },
  { title:"Sharing Your Information", body:`We share your information only in these limited circumstances: with Razorpay to process your payment; with our lens laboratory to manufacture your prescription lenses; with courier partners to deliver your order; with legal or regulatory authorities if required by law.\n\nWe do not sell your personal information to any third party.` },
  { title:"Data Security", body:`We use industry-standard security measures including HTTPS encryption for all data transmission, secure database hosting via Supabase on AWS infrastructure, password hashing and secure session management, and regular security reviews.\n\nPayment card details are never stored on our servers — all payments are handled directly by Razorpay, which is PCI-DSS Level 1 certified.` },
  { title:"Cookies", body:`Our website uses cookies for essential functions (keeping you logged in, remembering your cart) and analytics (understanding how visitors use our site via anonymous statistics). You can disable non-essential cookies in your browser settings without affecting core site functionality.` },
  { title:"Your Rights", body:`You have the right to access the personal information we hold about you, correct any inaccurate information, request deletion of your account and associated data, opt out of marketing communications at any time, and download your prescription data.\n\nTo exercise any of these rights, email us at powereyes.chennai@gmail.com or contact us via WhatsApp on 9840496404.` },
  { title:"Changes to This Policy", body:`We may update this privacy policy from time to time. We will notify registered customers of significant changes via email or WhatsApp. Continued use of our website after a change constitutes acceptance of the updated policy.` },
];
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header/>
      <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
        <Link href="/" className="hover:underline">Home</Link> › <span className="font-medium text-slate-700">Privacy Policy</span>
      </div>
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 text-white px-6 py-10 text-center">
        <h1 className="font-extrabold text-3xl">Privacy Policy</h1>
        <p className="text-slate-300 mt-2">Last updated: January 2025</p>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-8">
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
          Power Eyes Opticals takes your privacy seriously. This policy explains what data we collect, why we collect it, and how we protect it — especially your sensitive eye prescription information.
        </div>
        {SECTIONS.map(s => (
          <div key={s.title} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
            <h2 className="font-bold text-lg text-navy-900 mb-3">{s.title}</h2>
            {s.body.split('\n\n').map((p,i)=><p key={i} className="text-sm text-slate-600 leading-relaxed mb-3 last:mb-0">{p}</p>)}
          </div>))}
        <div className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600 text-center">
          <p className="font-semibold text-navy-900">Questions about this policy?</p>
          <p className="mt-1">Email: powereyes.chennai@gmail.com &nbsp;|&nbsp; WhatsApp: 9840496404</p>
          <p className="mt-1">Power Eyes Opticals, 1st Floor, Mogappair East, Chennai – 600037</p>
        </div>
      </div>
      <Footer/>
    </div>);
}

