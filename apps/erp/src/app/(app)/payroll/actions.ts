"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { adminCtx } from "@/lib/admin-guard";
type R = { error?: string; ok?: string; id?: string };
const num = (v: unknown, max = 10_000_000) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };

export async function saveSalary(profileId: string, v: { basic: number; hra: number; other_allowance: number; pf_pct: number; esi_pct: number; professional_tax: number; effective_from?: string }): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Only the owner or an admin can edit salaries." };
  const basic = num(v.basic), hra = num(v.hra), oa = num(v.other_allowance), pf = num(v.pf_pct, 100), esi = num(v.esi_pct, 100), pt = num(v.professional_tax);
  if ([basic, hra, oa, pf, esi, pt].some(x => x === null)) return { error: "Enter valid non-negative numbers (percentages up to 100)." };
  if (!basic) return { error: "Basic pay must be more than zero." };
  const effectiveFrom = /^\d{4}-\d{2}-\d{2}$/.test(v.effective_from ?? "") ? v.effective_from! : new Date().toISOString().slice(0, 10);
  const { error } = await a.sb.from("salary_structures").upsert({ org_id: a.orgId, profile_id: profileId, basic, hra, other_allowance: oa, pf_pct: pf, esi_pct: esi, professional_tax: pt, effective_from: effectiveFrom, updated_at: new Date().toISOString() }, { onConflict: "org_id,profile_id" });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); return { ok: "Salary saved." };
}
export async function removeSalary(profileId: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.from("salary_structures").delete().eq("profile_id", profileId);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); return { ok: "Salary removed." };
}
export async function generateRun(period: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Pick a month." };
  const { data, error } = await a.sb.rpc("generate_payroll", { p_period: `${period}-01` });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); return { ok: "Payroll generated.", id: data as string };
}
export async function savePayslip(id: string, paidDays: number, other: number, note: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  if (num(paidDays, 31) === null || num(other) === null) return { error: "Enter valid numbers." };
  const { error } = await a.sb.rpc("update_payslip", { p_id: id, p_paid_days: paidDays, p_other_deduction: other, p_note: note.slice(0, 200) || null });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll/run/[id]", "page"); return { ok: "Saved." };
}
export async function finalizeRun(id: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.rpc("finalize_payroll", { p_run: id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); revalidatePath("/payroll/run/[id]", "page"); return { ok: "Payroll finalised. Employees can now see their payslips." };
}
export async function deleteRun(id: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  const { error } = await a.sb.rpc("delete_draft_payroll", { p_run: id });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); return { ok: "Draft deleted." };
}
export async function markPaid(id: string, method: string, reference: string, date: string): Promise<R> {
  const a = await adminCtx(); if (!a) return { error: "Not allowed." };
  if (!["bank", "cash", "upi", "cheque"].includes(method)) return { error: "Choose a payment method." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose the payment date." };
  const { error } = await a.sb.rpc("mark_payslip_paid", { p_id: id, p_method: method, p_reference: reference.slice(0, 80) || null, p_date: date });
  if (error) return { error: dbError(error.message) };
  revalidatePath("/payroll"); revalidatePath("/payroll/run/[id]", "page"); return { ok: "Marked paid." };
}
