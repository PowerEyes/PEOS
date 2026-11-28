"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { adminCtx } from "@/lib/admin-guard";

type R = { error?: string; ok?: string };

export async function saveAttendance(input: {
  profile_id: string;
  work_date: string;
  status: string;
  leave_type_id: string;
  paid_days: number;
  note: string;
}): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Only the owner or an admin can mark attendance." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) return { error: "Choose a date." };
  const paid = Number(input.paid_days);
  if (!Number.isFinite(paid) || paid < 0 || paid > 1) return { error: "Paid days must be between 0 and 1." };
  const { error } = await a.sb.rpc("save_attendance_day", {
    p_profile: input.profile_id,
    p_date: input.work_date,
    p_status: input.status,
    p_leave_type: input.leave_type_id || null,
    p_paid_days: paid,
    p_note: input.note ?? "",
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/attendance");
  return { ok: "Attendance saved." };
}

export async function deleteAttendance(id: string): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.from("attendance_days").delete().eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/attendance");
  return { ok: "Attendance removed." };
}
