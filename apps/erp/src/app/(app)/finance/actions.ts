"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string; id?: string };

export async function addExpense(input: unknown): Promise<R> {
  const s = z.object({ category: z.string().min(1), description: z.string().min(1), amount: z.number().positive(), expense_date: z.string(), payment_method: z.enum(["cash","upi","card","bank"]), reference: z.string().optional(), branch_id: z.string().uuid() }).safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const { error } = await supabaseServer().from("expenses").insert(s.data);
  if (error) return { error: dbError(error.message) }; revalidatePath("/finance"); return { ok: "Expense saved" };
}
export async function addPurchaseInvoice(input: unknown): Promise<R> {
  const s = z.object({ supplier_name: z.string().min(1), supplier_gstin: z.string().optional(), invoice_no: z.string().min(1), invoice_date: z.string(), supply_type: z.enum(["intrastate","interstate"]), branch_id: z.string().uuid(),
    items: z.array(z.object({ description: z.string(), hsn: z.string().optional(), qty: z.number().int().positive(), unit_price: z.number().positive(), tax_pct: z.number().min(0).max(28) })) }).safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const d = s.data; const sb = supabaseServer();
  let sub = 0, cg = 0, sg = 0, ig = 0, tax = 0, grand = 0;
  const itemRows = d.items.map((i) => {
    const taxable = Math.round(i.qty * i.unit_price * 100) / 100;
    const taxAmt = Math.round(taxable * i.tax_pct / 100 * 100) / 100;
    const half = Math.round(taxAmt / 2 * 100) / 100;
    const cgst = d.supply_type === "intrastate" ? half : 0, sgst = d.supply_type === "intrastate" ? taxAmt - half : 0, igst = d.supply_type === "interstate" ? taxAmt : 0;
    sub += taxable; tax += taxAmt; grand += taxable + taxAmt;
    cg += cgst; sg += sgst; ig += igst;
    return { description: i.description, hsn: i.hsn, qty: i.qty, unit_price: i.unit_price, tax_pct: i.tax_pct, taxable_value: taxable, cgst_amt: cgst, sgst_amt: sgst, igst_amt: igst, line_total: taxable + taxAmt };
  });
  const { data, error } = await sb.from("purchase_invoices").insert({ ...d, subtotal: sub, tax_total: tax, grand_total: grand, cgst_total: cg, sgst_total: sg, igst_total: ig }).select("id").single();
  if (error) return { error: dbError(error.message) };
  await sb.from("purchase_items").insert(itemRows.map((r) => ({ ...r, purchase_id: data.id })));
  revalidatePath("/finance"); return { ok: "Purchase invoice saved", id: data.id };
}
export async function saveDayClosing(input: unknown): Promise<R> {
  const s = z.object({ branch_id: z.string().uuid(), closing_date: z.string(), opening_cash: z.number().min(0), actual_cash: z.number().min(0), expected_cash: z.number(), cash_sales: z.number(), upi_sales: z.number(), card_sales: z.number(), bank_sales: z.number(), total_sales: z.number(), order_count: z.number().int(), notes: z.string().optional() }).safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const v = s.data; const { error } = await supabaseServer().from("day_closings").upsert({ ...v, cash_difference: v.actual_cash - v.expected_cash }, { onConflict: "org_id,branch_id,closing_date" });
  if (error) return { error: dbError(error.message) }; revalidatePath("/finance"); return { ok: "Day closed" };
}
/** Cash movements recorded in the ledger for one branch on one day. Drives the
 *  Day Closing split — previously UPI/card/bank were hard-coded to zero. */
export async function getDayBook(branch_id: string, closing_date: string): Promise<{
  error?: string; cash_in?: number; upi_in?: number; card_in?: number; bank_in?: number;
  other_in?: number; cash_out?: number; total_in?: number; total_out?: number; order_count?: number;
}> {
  const s = z.object({ branch_id: z.string().uuid(), closing_date: z.string().min(10) }).safeParse({ branch_id, closing_date });
  if (!s.success) return { error: "Choose a branch and a date." };
  const { data, error } = await supabaseServer().from("cashbook")
    .select("direction, method, amount, sale_id")
    .eq("branch_id", s.data.branch_id).eq("occurred_on", s.data.closing_date);
  if (error) return { error: dbError(error.message) };
  const rows = data ?? [];
  const amt = (dir: string, methods?: string[]) =>
    rows.filter(r => r.direction === dir && (!methods || methods.includes(r.method)))
        .reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const cash_in = amt("in", ["cash"]), upi_in = amt("in", ["upi"]);
  const card_in = amt("in", ["card"]), bank_in = amt("in", ["bank", "razorpay"]);
  const other_in = amt("in", ["other"]);
  return {
    cash_in, upi_in, card_in, bank_in, other_in,
    cash_out: amt("out", ["cash"]), total_in: amt("in"), total_out: amt("out"),
    order_count: new Set(rows.filter(r => r.sale_id).map(r => r.sale_id)).size,
  };
}
export async function createCreditNote(input: unknown): Promise<R> {
  const s = z.object({ sale_id: z.string().uuid(), reason: z.string().min(1), refund_method: z.string().optional(), lines: z.array(z.object({ line_id: z.string().uuid(), qty: z.number().int().positive() })) }).safeParse(input);
  if (!s.success) return { error: s.error.issues[0].message };
  const { data, error } = await supabaseServer().rpc("create_credit_note", { p: s.data });
  if (error) return { error: dbError(error.message) }; revalidatePath("/finance"); revalidatePath("/sales"); return { ok: data.code, id: data.id };
}
export async function closePeriod(year: number, month: number): Promise<R> {
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: "Invalid period" };
  const sb = supabaseServer(); const start = `${year}-${String(month).padStart(2,"0")}-01`;
  const end = new Date(year, month, 1).toISOString().slice(0,10);
  const [{ data: out }, { data: inp }] = await Promise.all([
    sb.from("sales").select("cgst_total, sgst_total, igst_total").eq("kind","order").neq("status","cancelled").gte("created_at",start).lt("created_at",end),
    sb.from("purchase_items").select("cgst_amt, sgst_amt, igst_amt").gte("created_at",start).lt("created_at",end)]);
  const sum = (arr: any[], k: string) => arr.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const oc = sum(out ?? [], "cgst_total"), os = sum(out ?? [], "sgst_total"), oi = sum(out ?? [], "igst_total");
  const ic = sum(inp ?? [], "cgst_amt"), is2 = sum(inp ?? [], "sgst_amt"), ii = sum(inp ?? [], "igst_amt");
  const { error } = await sb.from("gst_periods").upsert({ period_year: year, period_month: month, status: "closed", output_cgst: oc, output_sgst: os, output_igst: oi, input_cgst: ic, input_sgst: is2, input_igst: ii, net_liability: Math.max(0, (oc+os+oi) - (ic+is2+ii)), closed_at: new Date().toISOString() }, { onConflict: "org_id,period_year,period_month" });
  if (error) return { error: dbError(error.message) }; revalidatePath("/finance"); return { ok: `${year}-${String(month).padStart(2,"0")} closed` };
}
