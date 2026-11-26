import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PrintButton } from "./print";
export const dynamic = "force-dynamic";
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// RLS decides access: admins see all, an employee sees only their own finalised slip.
export default async function Slip({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser(); if (!user) redirect("/login");
  const { data: s } = await sb.from("payslips").select("*,profiles(full_name,role_key),payroll_runs(period,status),branches(name)").eq("id", params.id).maybeSingle();
  if (!s) notFound();
  const [{ data: org }, { data: co }] = await Promise.all([sb.from("organizations").select("name").limit(1).maybeSingle(), sb.from("org_settings").select("value").eq("key", "company_name").maybeSingle()]);
  const company = (typeof co?.value === "string" && co.value) || org?.name || "";
  const month = new Date((s as any).payroll_runs.period + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const earn: [string, number][] = [["Basic", s.basic], ["HRA", s.hra], ["Other allowance", s.other_allowance]];
  const ded: [string, number][] = [["Provident fund", s.pf], ["ESI", s.esi], ["Professional tax", s.professional_tax], ["Other deductions", s.other_deduction]];
  return (<div className="mx-auto max-w-2xl rounded-xl border bg-white p-6 print:border-0 print:p-0">
    <div className="mb-4 flex items-start justify-between"><div><h1 className="text-lg font-semibold">{company}</h1><p className="text-sm text-slate-500">Payslip · {month}</p></div><PrintButton /></div>
    <p className="text-sm"><b>{(s as any).profiles?.full_name}</b> · <span className="capitalize">{(s as any).profiles?.role_key}</span>{(s as any).branches?.name ? ` · ${(s as any).branches.name}` : ""}</p>
    <p className="mb-4 text-xs text-slate-500">Paid days {Number(s.paid_days)} of {s.days_in_month}</p>
    <div className="grid grid-cols-2 gap-6 text-sm">
      <div><h2 className="mb-1 font-medium">Earnings</h2>{earn.map(([k, v]) => <div key={k} className="flex justify-between border-t py-1"><span>{k}</span><span>{inr(Number(v))}</span></div>)}<div className="flex justify-between border-t py-1 font-medium"><span>Gross (pro-rated)</span><span>{inr(Number(s.gross))}</span></div></div>
      <div><h2 className="mb-1 font-medium">Deductions</h2>{ded.map(([k, v]) => <div key={k} className="flex justify-between border-t py-1"><span>{k}</span><span>{inr(Number(v))}</span></div>)}</div>
    </div>
    <div className="mt-4 flex justify-between rounded-lg bg-slate-100 px-3 py-2 font-semibold"><span>Net pay</span><span>{inr(Number(s.net))}</span></div>
    {s.note && <p className="mt-3 text-xs text-slate-500">Note: {s.note}</p>}
    <p className="mt-3 text-xs text-slate-500">{s.paid_on ? `Paid on ${s.paid_on} by ${s.payment_method}${s.payment_reference ? ` (ref ${s.payment_reference})` : ""}` : "Payment pending"}</p>
  </div>);
}
