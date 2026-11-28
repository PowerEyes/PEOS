import Link from "next/link";
import { PRODUCT } from "@/lib/env";
const AREAS = [["Point of sale & GST billing", "Fast counters, tax invoices, returns and credit notes."], ["Prescriptions & eye tests", "Clinical records, family accounts and recall reminders."], ["Lab, workshop & delivery", "Track every order from frame selection to hand-over."], ["Multi-branch inventory", "Stock by branch, transfers with approval, low-stock alerts."], ["Online store & customer portal", "Your own website, orders and customer accounts in one system."], ["Finance, payroll & backups", "Expenses, bank reconciliation, payroll and nightly Google Drive backups."]];
export default function Home() {
  return (<>
    <section className="mx-auto max-w-4xl px-4 py-20 text-center"><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">One system for your whole optical business</h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{PRODUCT} connects your stores, clinic, lab and website, with every branch and role kept separate and secure.</p>
      <div className="mt-8 flex justify-center gap-3"><Link href="/contact" className="btn">Request access</Link><Link href="/pricing" className="rounded-lg border px-4 py-2.5 text-sm font-medium">See pricing</Link></div></section>
    <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">{AREAS.map(([t, d]) => <div key={t} className="rounded-xl border p-5"><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}</section></>);
}
