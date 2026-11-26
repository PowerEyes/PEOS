import { redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
import { AttendanceView } from "./view";

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: { searchParams: { month?: string } }) {
  const a = await adminCtx();
  if (!a) redirect("/payroll/mine");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "")
    ? searchParams.month! : new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);

  const [{ data: staff }, { data: rows }, { data: types }] = await Promise.all([
    a.sb.from("profiles").select("id,full_name,role_key,branch_id")
      .eq("is_approved", true).eq("deactivated", false).order("full_name"),
    a.sb.from("attendance_days").select("*,profiles(full_name)")
      .gte("work_date", start).lt("work_date", end).order("work_date"),
    a.sb.from("leave_types").select("id,code,name,is_paid").eq("is_active", true).order("name"),
  ]);
  return <div className="mx-auto max-w-6xl space-y-4"><AttendanceView
    month={month} staff={staff ?? []} rows={rows ?? []} types={types ?? []} /></div>;
}
