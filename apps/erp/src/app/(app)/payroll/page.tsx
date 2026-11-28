import { redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
import { PayrollView } from "./view";
export const dynamic = "force-dynamic";
export default async function Payroll() {
  const a = await adminCtx(); if (!a) redirect("/payroll/mine");
  const [{ data: staff }, { data: sal }, { data: runs }] = await Promise.all([
    a.sb.from("profiles").select("id,full_name,role_key").eq("deactivated", false).eq("is_approved", true).order("full_name"),
    a.sb.from("salary_structures").select("*"),
    a.sb.from("payroll_runs").select("id,period,status,finalized_at,payslips(net)").order("period", { ascending: false }).limit(24),
  ]);
  const rows = (runs ?? []).map((r: any) => ({ id: r.id, period: r.period, status: r.status, count: r.payslips?.length ?? 0, total: (r.payslips ?? []).reduce((n: number, p: any) => n + Number(p.net), 0) }));
  return <div className="mx-auto max-w-6xl space-y-4"><PayrollView staff={staff ?? []} salaries={sal ?? []} runs={rows} /></div>;
}
