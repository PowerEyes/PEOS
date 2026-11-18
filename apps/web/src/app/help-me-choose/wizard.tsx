"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";
const Q = [
  { id:"use",   q:"What will you mainly use your glasses for?",         opts:["Reading & office work","Computer & screens","Driving","Outdoor & sports","Fashion & everyday","Distance vision","All of the above – progressive"] },
  { id:"age",   q:"What age group are you shopping for?",              opts:["Under 12","12–17","18–40","41–60","60+"] },
  { id:"prev",  q:"Have you worn glasses before?",                     opts:["First time","Yes, I have a prescription","Yes, and I want to upgrade"] },
  { id:"budget",q:"What is your budget for the complete pair?",        opts:["Under ₹2,000","₹2,000 – ₹5,000","₹5,000 – ₹10,000","₹10,000 – ₹20,000","No budget limit, best quality please"] },
  { id:"face",  q:"Which face shape best describes you?",              opts:["Round","Oval","Square","Heart / V-shaped","Long / Oblong","Not sure"] },
];
const REC: Record<string, { title: string; desc: string; href: string; tag: string }[]> = {
  default: [{ title:"Classic Eyeglasses",desc:"Best for everyday use. Wide selection across all budgets.",href:"/eyeglasses",tag:"Most popular" },{ title:"Progressive Lenses",desc:"See near and far with no visible line. Ideal for 40+.",href:"/lenses?type=progressive",tag:"Expert pick" },{ title:"Computer Glasses",desc:"Blue-light blocking lenses for screen-heavy days.",href:"/lenses?type=blue_light",tag:"Trending" }],
};
export function HelpMeChoose() {
  const { whatsappNumber } = useSite();
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Record<string,string>>({}); const [done, setDone] = useState(false);
  function pick(val: string) { const id = Q[step].id; setAnswers({ ...answers, [id]: val }); if (step < Q.length - 1) setStep(s => s + 1); else setDone(true); }
  if (done) return (
    <div className="mx-auto max-w-2xl section-pad px-4">
      <div className="text-center mb-8"><h2 className="font-display text-3xl font-bold text-navy-900">Our Recommendations for You</h2>
        <p className="text-slate-500 mt-2">Based on your answers, here's what we suggest</p></div>
      <div className="space-y-4">
        {REC.default.map((r,i) => (
          <Link key={r.title} href={r.href} className="flex items-center gap-4 card p-5 hover:shadow-lg transition hover:-translate-y-0.5">
            <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-xl ${i===0?"bg-blue-50":i===1?"bg-violet-50":"bg-emerald-50"}`}>{["🕶️","🔭","💻"][i]}</div>
            <div className="flex-1"><div className="flex items-center gap-2"><p className="font-bold text-navy-900">{r.title}</p><span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold text-gold-700">{r.tag}</span></div><p className="text-sm text-slate-500 mt-0.5">{r.desc}</p></div>
            <ArrowRight size={18} className="text-gold-500 shrink-0"/></Link>))}
      </div>
      <div className="mt-8 rounded-2xl bg-navy-50 p-6 text-center"><p className="font-semibold text-navy-900">Want expert advice?</p>
        <p className="text-sm text-slate-600 mt-1">Book a free in-store consultation or chat on WhatsApp</p>
        <div className="mt-4 flex justify-center gap-3"><Link href="/eye-test" className="btn-gold text-sm">Book Eye Test</Link><a href={waHref(whatsappNumber)} className="btn-navy text-sm">💬 WhatsApp</a></div></div>
      <button onClick={()=>{setStep(0);setAnswers({});setDone(false);}} className="mt-6 w-full text-center text-sm text-navy-700 underline">Start over</button>
    </div>);
  const cur = Q[step];
  return (
    <div className="mx-auto max-w-lg section-pad px-4">
      <div className="text-center mb-8"><h1 className="font-display text-4xl font-bold text-navy-900">EYES Consultation</h1>
        <p className="text-slate-500 mt-2">Answer a few quick questions and we'll help you find the perfect eyewear</p>
        <div className="mt-4 flex gap-1 justify-center">{Q.map((_,i)=><div key={i} className={`h-1.5 w-8 rounded-full transition ${i<=step?"bg-gold-500":"bg-slate-200"}`}/>)}</div></div>
      <AnimatePresence mode="wait"><motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:.2}}>
        <div className="card p-6"><p className="text-sm text-slate-500 mb-1">Question {step+1} of {Q.length}</p>
          <h2 className="font-display text-xl font-bold text-navy-900 mb-5">{cur.q}</h2>
          <div className="space-y-2">{cur.opts.map(o=>(
            <button key={o} onClick={()=>pick(o)} className="flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 px-4 py-3.5 text-left text-sm font-medium text-slate-700 transition hover:border-gold-400 hover:bg-amber-50 active:scale-[.99]">
              {o}<ChevronRight size={16} className="text-slate-400"/></button>))}</div></div>
      </motion.div></AnimatePresence>
      {step > 0 && <button onClick={()=>setStep(s=>s-1)} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-navy-700">← Back</button>}
    </div>);
}
