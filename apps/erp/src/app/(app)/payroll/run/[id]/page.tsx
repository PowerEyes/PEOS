import { notFound, redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
import { RunView } from "./view";
export const dynamic = "force-dynamic";
export default async function Run({ params }: { params: { id: string } }) {
  const a = await adminCtx(); if (!a) redirect("/payroll/mine");
  const [{ data: run }, { data: slips }] = await Promise.all([
    a.sb.from("payroll_runs").select("id,period,status").eq("id", params.id).maybeSingle(),
    a.sb.from("payslips").select("*,profiles(full_name)").eq("run_id", params.id),
  ]);
  if (!run) notFound();
  const rows = (slips ?? []).map((s: any) => ({ ...s, name: s.profiles?.full_name ?? "—" })).sort((x: any, y: any) => x.name.localeCompare(y.name));
  return <div className="mx-auto max-w-6xl space-y-4"><RunView run={run} slips={rows} /></div>;
}
