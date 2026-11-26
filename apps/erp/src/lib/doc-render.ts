// Server-side PDF layouts built ONLY from trusted database rows (service client or the caller's RLS client).
import { Pdf, textWidth } from "./pdf-lite.ts";
import type { DocType } from "./doclinks";

const inr = (n: unknown) => "Rs. " + Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (x: unknown) => (x ? new Date(String(x)).toLocaleDateString("en-IN") : "-");
const v = (x: unknown) => (x === null || x === undefined || x === "" ? "-" : String(x));

async function header(sb: any, p: Pdf, title: string, branch?: any, meta?: [string, string][]) {
  const { data: org } = await sb.from("organizations").select("name").limit(1).maybeSingle();
  p.line(org?.name ?? "", 15, true); if (branch?.address) p.line(branch.address, 7.5); if (branch?.phone) p.line(`Ph: ${branch.phone}`, 7.5);
  p.gap(4); p.rule(); p.gap(2); p.line(title, 12, true);
  meta?.forEach(([k, val]) => p.pair(k, val, 8.5)); p.gap(4);
  return org?.name as string | undefined;
}

export async function buildDocPdf(sb: any, type: DocType, id: string): Promise<{ pdf: Buffer; filename: string } | null> {
  const p = new Pdf();
  if (type === "sale") {
    const { data: s } = await sb.from("sales").select("*, customers!sales_customer_id_fkey(*), sale_lines(*), payments(*), branches(*)").eq("id", id).maybeSingle();
    if (!s) return null; const c = s.customers, b = s.branches;
    const title = s.kind === "quotation" ? "QUOTATION" : s.gst_applied ? "TAX INVOICE" : "BILL OF SUPPLY";
    const name = await header(sb, p, title, b, [["Number", s.code], ["Date", dt(s.created_at)], ...(s.kind === "quotation" && s.valid_until ? [["Valid till", dt(s.valid_until)] as [string, string]] : []), ["Customer", `${c?.full_name} (${c?.phone})`]]);
    const lines = [...(s.sale_lines ?? [])].sort((a: any, z: any) => a.line_no - z.line_no);
    p.table(["#", "Item", "Qty", "Rate", "Total"], lines.map((l: any) => [l.line_no, l.description + (l.details ? ` - ${l.details}` : ""), l.qty, inr(l.unit_price), inr(l.line_total)]),
      [{ w: .07, a: "c" }, { w: .43 }, { w: .08, a: "c" }, { w: .2, a: "r" }, { w: .22, a: "r" }]);
    p.gap(6);
    const tot = (k: string, val: unknown, bold = false) => p.line(`${k}:  ${val}`, 9, bold, "r");
    if (Number(s.discount_total) > 0) tot("Discount", inr(s.discount_total));
    if (s.gst_applied) { if (Number(s.cgst_total) > 0) { tot("CGST", inr(s.cgst_total)); tot("SGST", inr(s.sgst_total)); } if (Number(s.igst_total) > 0) tot("IGST", inr(s.igst_total)); }
    tot("Grand total", inr(s.grand_total), true); tot("Paid", inr(s.paid_total));
    const bal = Number(s.grand_total) - Number(s.paid_total); tot("Balance due", inr(Math.max(bal, 0)), true);
    p.gap(8); p.line(`Thank you for choosing ${name ?? "us"}.`, 8);
    return { pdf: p.build(s.code), filename: `${title.replace(/ /g, "-")}-${s.code}.pdf` };
  }
  if (type === "receipt") {
    const { data: r } = await sb.from("payments").select("*, sales(code, grand_total, paid_total, customers!sales_customer_id_fkey(full_name), branches(name, address, phone))").eq("id", id).maybeSingle();
    if (!r) return null; const s = r.sales;
    await header(sb, p, "PAYMENT RECEIPT", s?.branches, [["Received from", v(s?.customers?.full_name)], ["Against order", v(s?.code)], ["Date", dt(r.created_at)], ["Mode", `${v(r.method)}${r.reference ? ` (${r.reference})` : ""}`]]);
    p.line(`Amount received: ${inr(r.amount)}`, 13, true); p.gap(4);
    p.line(`Order total: ${inr(s?.grand_total)}   Balance: ${inr(Math.max(Number(s?.grand_total) - Number(s?.paid_total), 0))}`, 9);
    return { pdf: p.build(s?.code), filename: `Receipt-${s?.code ?? id.slice(0, 8)}.pdf` };
  }
  if (type === "rx") {
    const { data: r } = await sb.from("prescriptions").select("*, customers(*)").eq("id", id).maybeSingle();
    if (!r) return null; const c = r.customers;
    const { data: br } = r.branch_id ? await sb.from("branches").select("name,address,phone").eq("id", r.branch_id).maybeSingle() : { data: null };
    await header(sb, p, "EYE PRESCRIPTION", br, [["Rx no.", v(r.rx_code)], ["Date", dt(r.rx_date)], ["Patient", `${c?.full_name} (${c?.phone})`], ["Examined by", v(r.examined_by)], ["Valid till", dt(r.valid_till)]]);
    p.table(["", "Right (OD)", "Left (OS)"], [["SPH", r.od_sph, r.os_sph], ["CYL", r.od_cyl, r.os_cyl], ["AXIS", r.od_axis, r.os_axis], ["V/A distance", r.od_va_dist, r.os_va_dist], ["ADD", r.od_add, r.os_add], ["V/A near", r.od_va_near, r.os_va_near]].map((a) => a.map(v)),
      [{ w: .3 }, { w: .35, a: "c" }, { w: .35, a: "c" }], 9);
    p.gap(6); p.pair("PD far / near", `${v(r.pd_far)} / ${v(r.pd_near)}`); if (r.remarks) p.pair("Remarks", r.remarks);
    return { pdf: p.build(r.rx_code), filename: `Prescription-${r.rx_code ?? id.slice(0, 8)}.pdf` };
  }
  if (type === "repair") {
    const { data: r } = await sb.from("repairs").select("*, customers(*), branches(name, address, phone)").eq("id", id).maybeSingle();
    if (!r) return null;
    await header(sb, p, "REPAIR CARD", r.branches, [["Repair no.", v(r.code)], ["Received", dt(r.created_at)], ["Due", dt(r.due_date)], ["Customer", `${r.customers?.full_name} (${r.customers?.phone})`],
      ["Item", [r.item_type, r.item_brand, r.item_model, r.item_color].filter(Boolean).join(" ") || "-"], ["Problem", v(r.problem)], ["Status", v(r.status)]]);
    p.pair("Repair charges", inr(r.repair_charges)); p.pair("Parts", inr(r.parts_cost)); if (Number(r.discount) > 0) p.pair("Discount", inr(r.discount)); p.pair("Total", inr(r.total_amount));
    return { pdf: p.build(r.code), filename: `Repair-${r.code ?? id.slice(0, 8)}.pdf` };
  }
  if (type === "appointment") {
    const { data: a } = await sb.from("appointments").select("*, customers(full_name), branches(name, address, phone)").eq("id", id).maybeSingle();
    if (!a) return null;
    await header(sb, p, "APPOINTMENT CONFIRMATION", a.branches, [["Name", v(a.customers?.full_name)], ["Type", v(a.appt_type)], ["Date", new Date(a.appt_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })], ["Time", String(a.appt_time).slice(0, 5)], ["Branch", v(a.branches?.name)]]);
    p.line("Please carry your previous prescription and glasses, if any.", 8);
    return { pdf: p.build(), filename: `Appointment-${id.slice(0, 8)}.pdf` };
  }
  if (type === "credit_note") {
    const { data: n } = await sb.from("credit_notes").select("*, credit_note_lines(*)").eq("id", id).maybeSingle();
    if (!n) return null;
    await header(sb, p, "CREDIT NOTE", null, [["Number", v(n.code)], ["Date", dt(n.created_at)]]);
    p.table(["Item", "Qty", "Amount"], (n.credit_note_lines ?? []).map((l: any) => [l.description, l.qty, inr(l.line_total ?? l.taxable_value)]), [{ w: .6 }, { w: .1, a: "c" }, { w: .3, a: "r" }]);
    return { pdf: p.build(n.code), filename: `CreditNote-${n.code ?? id.slice(0, 8)}.pdf` };
  }
  return null; // lab job cards are internal and never shared
}
export { textWidth };
