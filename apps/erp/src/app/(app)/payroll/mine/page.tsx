import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Mine() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("payslips").select("id,net,paid_on,payroll_runs(period)").eq("profile_id", user?.id ?? "").limit(36);
  const rows = (data ?? []).sort((a: any, b: any) => String(b.payroll_runs?.period).localeCompare(String(a.payroll_runs?.period)));
  return (<div className="mx-auto max-w-2xl space-y-3"><h1 className="text-xl font-semibold">My payslips</h1>
    {rows.length === 0 ? <p className="text-sm text-slate-500">No payslips have been published for you yet.</p> :
      <ul className="divide-y rounded-xl border bg-white">{rows.map((r: any) => <li key={r.id} className="flex items-center justify-between p-3 text-sm"><span>{new Date(r.payroll_runs.period + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
        <span className="flex gap-4"><span>₹{Number(r.net).toLocaleString("en-IN")}</span><span className={r.paid_on ? "text-emerald-700" : "text-amber-600"}>{r.paid_on ? "Paid" : "Pending"}</span><Link className="text-brand-700 underline" href={`/payroll/slip/${r.id}`}>View</Link></span></li>)}</ul>}</div>);
}
