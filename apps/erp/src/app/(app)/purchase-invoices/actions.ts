"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string; id?: string };

type Line = { description: string; hsn: string; qty: number; rate: number; tax_pct: number };

function calcTotals(lines: Line[], supplyType: string) {
  let subtotal = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  const processed = lines.map(l => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const taxPct = Number(l.tax_pct) || 0;
    const lineSubtotal = qty * rate;
    const lineTax = lineSubtotal * taxPct / 100;
    const lineCgst = supplyType === "intrastate" ? lineTax / 2 : 0;
    const lineSgst = supplyType === "intrastate" ? lineTax / 2 : 0;
    const lineIgst = supplyType === "interstate" ? lineTax : 0;
    subtotal += lineSubtotal;
    taxable  += lineSubtotal;
    cgst += lineCgst; sgst += lineSgst; igst += lineIgst;
    return { ...l, qty, rate, tax_pct: taxPct, taxable: +lineSubtotal.toFixed(2), cgst: +lineCgst.toFixed(2), sgst: +lineSgst.toFixed(2), igst: +lineIgst.toFixed(2), line_total: +(lineSubtotal + lineTax).toFixed(2) };
  });
  return { processed, subtotal: +subtotal.toFixed(2), taxable_value: +taxable.toFixed(2), cgst_amount: +cgst.toFixed(2), sgst_amount: +sgst.toFixed(2), igst_amount: +igst.toFixed(2), grand_total: +(subtotal + cgst + sgst + igst).toFixed(2) };
}

export async function createSupplier(fd: FormData): Promise<R & { supplier?: any }> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return { error: "No organisation linked" };
  const { data, error } = await sb.from("suppliers").insert({
    org_id: profile.org_id,
    name: (fd.get("name") as string)?.trim(),
    gstin: (fd.get("gstin") as string)?.trim().toUpperCase() || null,
    state: (fd.get("state") as string) || "Tamil Nadu",
    address: (fd.get("address") as string) || null,
    phone: (fd.get("phone") as string) || null,
    email: (fd.get("email") as string) || null,
    contact_person: (fd.get("contact_person") as string) || null,
  }).select().single();
  if (error) return { error: error.message };
  revalidatePath("/purchase-invoices");
  return { ok: "Supplier added", supplier: data };
}

export async function upsertInvoice(invoiceId: string | null, payload: {
  supplier_id: string | null; supplier_name: string; supplier_gstin: string;
  invoice_no: string; invoice_date: string; due_date: string; po_ref: string;
  supply_type: string; lines: Line[]; itc_eligible: boolean; notes: string;
  branch_id: string | null; status: string;
}): Promise<R> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return { error: "No organisation" };
  if (!payload.invoice_no.trim()) return { error: "Invoice number is required" };
  if (!payload.invoice_date) return { error: "Invoice date is required" };
  if (!payload.supplier_name.trim()) return { error: "Supplier name is required" };
  if (!payload.lines.length) return { error: "Add at least one line item" };
  const { processed, ...totals } = calcTotals(payload.lines, payload.supply_type);
  const row = {
    org_id: profile.org_id,
    branch_id: payload.branch_id || null,
    supplier_id: payload.supplier_id || null,
    supplier_name: payload.supplier_name.trim(),
    supplier_gstin: payload.supplier_gstin.trim().toUpperCase() || null,
    invoice_no: payload.invoice_no.trim(),
    invoice_date: payload.invoice_date,
    due_date: payload.due_date || null,
    po_ref: payload.po_ref || null,
    supply_type: payload.supply_type,
    lines: processed,
    itc_eligible: payload.itc_eligible,
    notes: payload.notes || null,
    status: payload.status || "pending",
    ...totals,
  };
  let id = invoiceId;
  if (invoiceId) {
    const { error } = await sb.from("purchase_invoices").update(row).eq("id", invoiceId).eq("org_id", profile.org_id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await sb.from("purchase_invoices").insert({ ...row, created_by: user.id }).select("id").single();
    if (error) return { error: error.message };
    id = data.id;
  }
  revalidatePath("/purchase-invoices");
  return { ok: invoiceId ? "Invoice updated" : "Invoice created", id: id! };
}

export async function markPaid(id: string, payment: {
  paid_amount: number; payment_date: string; payment_mode: string; payment_ref: string;
}): Promise<R> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: inv } = await sb.from("purchase_invoices").select("grand_total").eq("id", id).single();
  if (!inv) return { error: "Invoice not found" };
  const fullyPaid = Number(payment.paid_amount) >= Number(inv.grand_total);
  const { error } = await sb.from("purchase_invoices").update({
    paid_amount: payment.paid_amount,
    payment_date: payment.payment_date || null,
    payment_mode: payment.payment_mode || null,
    payment_ref: payment.payment_ref || null,
    status: fullyPaid ? "paid" : "pending",
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/purchase-invoices");
  return { ok: fullyPaid ? "Marked as fully paid" : "Partial payment recorded" };
}

export async function claimITC(id: string, period: string): Promise<R> {
  const sb = supabaseServer();
  const { error } = await sb.from("purchase_invoices").update({ itc_claimed: true, itc_claim_period: period }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/purchase-invoices");
  return { ok: `ITC claimed for ${period}` };
}

export async function deleteInvoice(id: string): Promise<R> {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: inv } = await sb.from("purchase_invoices").select("status,paid_amount").eq("id", id).single();
  if (inv?.status === "paid" || Number(inv?.paid_amount) > 0) return { error: "Cannot delete a paid invoice. Cancel it instead." };
  const { error } = await sb.from("purchase_invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/purchase-invoices");
  return { ok: "Invoice deleted" };
}

export async function updateSupplier(id: string, fd: FormData): Promise<R & { supplier?: any }> {
  const sb = supabaseServer();
  const { error } = await sb.from("suppliers").update({
    name: fd.get("name"), gstin: (fd.get("gstin") as string)?.toUpperCase() || null,
    state: fd.get("state"), address: fd.get("address"), phone: fd.get("phone"),
    email: fd.get("email"), contact_person: fd.get("contact_person"),
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/purchase-invoices");
  return { ok: "Supplier updated" };
}
