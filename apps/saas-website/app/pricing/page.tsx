import Link from "next/link";
import { anonDb } from "@/lib/db";
export const revalidate = 300;
export const metadata = { title: "Pricing" };
const inr = (minor: number, cur: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur || "INR", maximumFractionDigits: 0 }).format(minor / 100);
const lim = (n: number | null, label: string) => n == null ? `Unlimited ${label}` : `${n.toLocaleString("en-IN")} ${label}`;
const label = (k: string) => k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
export default async function Pricing() {
  const { data, error } = await anonDb().rpc("public_plans");
  const plans = (data ?? []) as any[];
  return (<div className="mx-auto max-w-6xl px-4 py-14"><h1 className="text-center text-3xl font-bold">Pricing</h1>
    {error || plans.length === 0 ? <p className="mt-10 text-center text-slate-600">Plans are being finalised. <Link className="underline" href="/contact">Contact us</Link> for a quote.</p> :
      <div className="mt-10 grid gap-5 md:grid-cols-3">{plans.map(p => <div key={p.code} className="flex flex-col rounded-2xl border p-6"><h2 className="text-xl font-semibold">{p.name}</h2>
        <p className="mt-2 text-3xl font-bold">{p.price_minor == null ? "Custom" : <>{inr(p.price_minor, p.currency)}<span className="text-sm font-normal text-slate-500"> / {p.interval}</span></>}</p>
        {p.trial_days > 0 && <p className="text-sm text-slate-500">{p.trial_days}-day free trial</p>}
        <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-700"><li>{lim(p.max_branches, "branches")}</li><li>{lim(p.max_employees, "staff")}</li><li>{lim(p.max_customers, "customers")}</li>{p.storage_mb != null && <li>{(p.storage_mb / 1000).toLocaleString("en-IN")} GB storage</li>}
          {Object.entries(p.features ?? {}).filter(([, v]) => v).map(([k, v]) => <li key={k}>{label(k)}{typeof v === "string" ? ` (${v})` : ""}</li>)}</ul>
        <Link href={`/contact?plan=${encodeURIComponent(p.code)}`} className="btn mt-6">Choose {p.name}</Link></div>)}</div>}</div>);
}
