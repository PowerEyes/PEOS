"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";

type R = { error?: string; ok?: string; id?: string; po_no?: string };

const line = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1, "Quantity must be at least 1"),
  rate: z.number().min(0, "Rate cannot be negative"),
  tax_pct: z.number().min(0).max(28),
  hsn: z.string().max(20).nullable().optional(),
  description: z.string().max(300).optional(),
});
const payload = z.object({
  branch_id: z.string().uuid({ message: "Choose the branch this order is for" }),
  supplier_id: z.string().uuid().nullable().optional(),
  supplier_name: z.string().trim().min(1, "Choose or type the supplier"),
  supplier_gstin: z.string().trim().max(15).optional().default(""),
  order_date: z.string().min(1, "Order date is required"),
  expected_date: z.string().nullable().optional(),
  supply_type: z.enum(["intrastate", "interstate"]),
  notes: z.string().max(500).optional().default(""),
  lines: z.array(line).min(1, "Add at least one line item"),
});
type Line = z.infer<typeof line>;

/** GST split — mirrors the purchase invoice calculator so PO and invoice agree. */
function totals(lines: Line[], supply: string) {
  let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
  for (const l of lines) {
    const taxable = (Number(l.qty) || 0) * (Number(l.rate) || 0);
    const tax = taxable * (Number(l.tax_pct) || 0) / 100;
    subtotal += taxable;
    if (supply === "interstate") igst += tax;
    else { cgst += tax / 2; sgst += tax / 2; }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotal: r(subtotal), taxable_value: r(subtotal),
    cgst_amount: r(cgst), sgst_amount: r(sgst), igst_amount: r(igst),
    grand_total: r(subtotal + cgst + sgst + igst),
  };
}

async function me() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const { data: profile } = await sb.from("profiles").select("org_id").eq("id", user.id).single();
  if (!profile?.org_id) return { error: "No organisation linked" as const };
  const { data: allowed } = await sb.rpc("has_perm", { p: "purchases_manage" });
  if (!allowed) return { error: "You do not have permission to manage purchase orders." as const };
  return { sb, user, orgId: profile.org_id as string };
}

const lineKey = (lines: any[]) =>
  [...(lines ?? [])].map((l: any) => `${l.product_id}:${l.qty}`).sort().join("|");

export async function createPO(input: unknown): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const p = payload.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const ctx = await me(); if ("error" in ctx) return { error: ctx.error };
  const { sb, user, orgId } = ctx;

  // Duplicate PO guard: same supplier + branch + date + identical lines already open.
  const { data: same, error: e1 } = await sb.from("purchase_orders")
    .select("po_no, lines, status")
    .eq("org_id", orgId).eq("branch_id", p.data.branch_id)
    .eq("supplier_name", p.data.supplier_name.trim())
    .eq("order_date", p.data.order_date)
    .neq("status", "cancelled");
  if (e1) return { error: dbError(e1.message) };
  const dup = (same ?? []).find((po) => lineKey(po.lines ?? []) === lineKey(p.data.lines));
  if (dup) return { error: `Duplicate purchase order — ${dup.po_no} already orders these lines for this supplier on that date.` };

  const t = totals(p.data.lines, p.data.supply_type);
  const { data, error } = await sb.from("purchase_orders").insert({
    org_id: orgId,
    branch_id: p.data.branch_id,
    supplier_id: p.data.supplier_id || null,
    supplier_name: p.data.supplier_name.trim(),
    supplier_gstin: p.data.supplier_gstin?.trim().toUpperCase() || null,
    order_date: p.data.order_date,
    expected_date: p.data.expected_date || null,
    supply_type: p.data.supply_type,
    notes: p.data.notes || null,
    status: "draft",
    lines: p.data.lines.map((l) => ({ ...l, received_qty: 0 })),
    ...t,
    created_by: user.id,
  }).select("id, po_no").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/purchases");
  return { ok: `Purchase order ${data.po_no} created`, id: data.id, po_no: data.po_no };
}

export async function approvePO(id: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const ctx = await me(); if ("error" in ctx) return { error: ctx.error };
  const { sb, orgId } = ctx;
  const { data: po, error: e1 } = await sb.from("purchase_orders")
    .select("id, po_no, status").eq("id", id).eq("org_id", orgId).single();
  if (e1 || !po) return { error: "Purchase order not found" };
  if (po.status !== "draft") return { error: `Only draft orders can be approved (this one is ${po.status}).` };
  const { error } = await sb.from("purchase_orders")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", orgId).eq("status", "draft");
  if (error) return { error: dbError(error.message) };
  revalidatePath("/purchases");
  return { ok: `${po.po_no} approved and ready for goods receipt` };
}

export async function cancelPO(id: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const ctx = await me(); if ("error" in ctx) return { error: ctx.error };
  const { sb, orgId } = ctx;
  const { data: po, error: e1 } = await sb.from("purchase_orders")
    .select("id, po_no, status, lines").eq("id", id).eq("org_id", orgId).single();
  if (e1 || !po) return { error: "Purchase order not found" };
  if (po.status === "cancelled") return { error: `${po.po_no} is already cancelled` };
  if (po.status === "received") return { error: `Goods for ${po.po_no} are already fully received — it cannot be cancelled.` };
  const received = (po.lines ?? []).reduce((a: number, l: any) => a + (Number(l.received_qty) || 0), 0);
  if (received > 0) return { error: `${received} unit(s) of ${po.po_no} have already been received — cancel is not allowed. Raise a return instead.` };
  const { error } = await sb.from("purchase_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", orgId);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/purchases");
  return { ok: `${po.po_no} cancelled` };
}

/** GRN: books stock into the PO's branch and upserts the linked purchase invoice. */
export async function receivePO(id: string, incoming: { product_id: string; qty: number }[], note?: string): Promise<R> {
  const gate = await subscriptionGate(); if (gate) return gate;
  const ctx = await me(); if ("error" in ctx) return { error: ctx.error };
  const { sb, user, orgId } = ctx;

  const { data: po, error: e1 } = await sb.from("purchase_orders")
    .select("*").eq("id", id).eq("org_id", orgId).single();
  if (e1 || !po) return { error: "Purchase order not found" };
  if (po.status === "cancelled") return { error: `${po.po_no} is cancelled — goods cannot be received.` };
  if (po.status === "draft") return { error: `Approve ${po.po_no} before receiving goods.` };
  if (po.status === "received") return { error: `${po.po_no} has already been fully received.` };

  const lines: any[] = Array.isArray(po.lines) ? po.lines : [];
  const byProduct = new Map<string, number>();
  for (const r of incoming ?? []) {
    const qty = Number(r.qty);
    if (!r.product_id || !Number.isInteger(qty) || qty <= 0) return { error: "Every received quantity must be a whole number above zero." };
    if (byProduct.has(r.product_id)) return { error: "The same product appears twice in this receipt." };
    byProduct.set(r.product_id, qty);
  }
  if (!byProduct.size) return { error: "Enter the quantities received against at least one line." };

  let updated: any[];
  try {
    updated = lines.map((l) => {
      const want = byProduct.get(l.product_id);
      if (want === undefined) return l;
      const remaining = (Number(l.qty) || 0) - (Number(l.received_qty) || 0);
      if (want > remaining) throw new Error(`Only ${remaining} of ${l.qty} unit(s) of ${l.description ?? l.sku} remain to receive on ${po.po_no}.`);
      return { ...l, received_qty: (Number(l.received_qty) || 0) + want };
    });
  } catch (e: any) {
    return { error: e.message };
  }
  const receivedLines = updated.filter((l) => (Number(l.received_qty) || 0) > 0);
  const fullyReceived = updated.every((l) => (Number(l.received_qty) || 0) >= (Number(l.qty) || 0));

  try {
    // Stock into this branch only (branch isolation).
    for (const [product_id, qty] of byProduct) {
      const { error } = await sb.from("stock_movements").insert({
        org_id: orgId, branch_id: po.branch_id, product_id, delta: qty,
        reason: "purchase", note: `PO ${po.po_no}`,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e: any) {
    return { error: dbError(e.message) };
  }

  const { error: e2 } = await sb.from("purchase_orders").update({
    lines: updated,
    status: fullyReceived ? "received" : "partially_received",
    received_at: fullyReceived ? new Date().toISOString() : po.received_at,
  }).eq("id", id).eq("org_id", orgId);
  if (e2) return { error: dbError(e2.message) };

  const { error: e3 } = await sb.from("purchase_order_receipts").insert({
    org_id: orgId, po_id: po.id, branch_id: po.branch_id,
    lines: [...byProduct].map(([product_id, qty]) => {
      const l = lines.find((x) => x.product_id === product_id);
      return { product_id, qty, rate: Number(l?.rate) || 0 };
    }),
    note: note || null, received_by: user.id,
  });
  if (e3) return { error: dbError(e3.message) };

  // Book the supplier liability for everything received so far.
  const invLines = receivedLines.map((l) => ({
    description: l.description ?? l.sku ?? "Purchase line", hsn: l.hsn ?? "",
    qty: Number(l.received_qty) || 0, rate: Number(l.rate) || 0,
    tax_pct: Number(l.tax_pct) || 0, product_id: l.product_id,
  }));
  const t = totals(invLines as Line[], po.supply_type);
  const invRow = {
    branch_id: po.branch_id, supplier_id: po.supplier_id, supplier_name: po.supplier_name,
    supplier_gstin: po.supplier_gstin, invoice_no: po.po_no,
    invoice_date: new Date().toISOString().slice(0, 10), due_date: po.expected_date,
    po_ref: po.po_no, supply_type: po.supply_type, lines: invLines, ...t,
    // both column families exist in the live schema (0006 and 0011 styles)
    tax_total: t.cgst_amount + t.sgst_amount + t.igst_amount,
    cgst_total: t.cgst_amount, sgst_total: t.sgst_amount, igst_total: t.igst_amount,
    itc_eligible: true, status: "pending",
    notes: `Goods receipt against ${po.po_no}`,
    stock_posted_at: new Date().toISOString(), // stock is booked by this PO flow
  };
  let invoiceId = po.invoice_id;
  if (invoiceId) {
    const { error } = await sb.from("purchase_invoices").update(invRow).eq("id", invoiceId).eq("org_id", orgId);
    if (error) return { error: dbError(error.message) };
  } else {
    const { data, error } = await sb.from("purchase_invoices")
      .insert({ ...invRow, org_id: orgId, created_by: user.id }).select("id").single();
    if (error) return { error: dbError(error.message) };
    invoiceId = data.id;
    const { error: e4 } = await sb.from("purchase_orders").update({ invoice_id: invoiceId }).eq("id", id);
    if (e4) return { error: dbError(e4.message) };
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/purchase-invoices");
  const got = [...byProduct.values()].reduce((a, b) => a + b, 0);
  return { ok: fullyReceived
    ? `${po.po_no} fully received — ${got} unit(s) added to stock`
    : `${po.po_no} partially received — ${got} unit(s) added to stock` };
}
