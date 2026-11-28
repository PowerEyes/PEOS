import { redirect } from "next/navigation";
import { adminCtx } from "@/lib/admin-guard";
import { LeaveView } from "./view";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const a = await adminCtx();
  if (!a) redirect("/payroll/mine");
  const [{ data: requests }, { data: staff }, { data: types }, { data: holidays }] = await Promise.all([
    a.sb.from("leave_requests").select("*,profiles(full_name),leave_types(name,is_paid)")
      .order("created_at", { ascending: false }).limit(200),
    a.sb.from("profiles").select("id,full_name").eq("is_approved", true).eq("deactivated", false).order("full_name"),
    a.sb.from("leave_types").select("id,code,name,is_paid,is_active").order("name"),
    a.sb.from("holidays").select("id,name,holiday_date").order("holiday_date"),
  ]);
  return <div className="mx-auto max-w-6xl space-y-4"><LeaveView
    requests={requests ?? []} staff={staff ?? []} types={types ?? []} holidays={holidays ?? []} /></div>;
}
