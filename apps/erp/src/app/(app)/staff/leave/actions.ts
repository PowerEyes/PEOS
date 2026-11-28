"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { adminCtx } from "@/lib/admin-guard";

type R = { error?: string; ok?: string };

export async function recordLeave(input: {
  profile_id: string; leave_type_id: string; from_date: string;
  to_date: string; days: number; reason: string;
}): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Only the owner or an admin can record leave." };
  const days = Number(input.days);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from_date) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to_date))
    return { error: "Choose valid dates." };
  if (!Number.isFinite(days) || days <= 0) return { error: "Enter the number of leave days." };
  const { error } = await a.sb.rpc("create_leave_for", {
    p_profile: input.profile_id,
    p_leave_type: input.leave_type_id,
    p_from: input.from_date,
    p_to: input.to_date,
    p_days: days,
    p_reason: input.reason ?? "",
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/leave");
  return { ok: "Leave request recorded." };
}

export async function decideLeave(id: string, approve: boolean): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.rpc("approve_leave", { p_id: id, p_approve: approve });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/leave");
  revalidatePath("/staff/attendance");
  return { ok: approve ? "Leave approved and attendance updated." : "Leave rejected." };
}

export async function saveLeaveType(input: {
  id: string; code: string; name: string; is_paid: boolean; is_active: boolean;
}): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.rpc("save_leave_type", {
    p_id: input.id || null, p_code: input.code, p_name: input.name,
    p_is_paid: input.is_paid, p_is_active: input.is_active,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/leave");
  return { ok: "Leave type saved." };
}

export async function saveHoliday(input: { id: string; name: string; holiday_date: string }): Promise<R> {
  const a = await adminCtx();
  if (!a) return { error: "Not allowed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.holiday_date)) return { error: "Choose a date." };
  const { error } = await a.sb.rpc("save_holiday", {
    p_id: input.id || null, p_name: input.name, p_date: input.holiday_date,
  });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/staff/leave");
  return { ok: "Holiday saved." };
}
