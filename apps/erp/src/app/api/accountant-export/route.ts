import { NextResponse } from "next/server";
import { deflateRawSync } from "node:zlib";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const csv = (rows: Record<string, unknown>[], columns: string[]) => {
  const quote = (v: unknown) => { const raw = String(v ?? ""), s = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw; return /[,\"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\uFEFF" + [columns.map(quote).join(","), ...rows.map(r => columns.map(c => quote(r[c])).join(","))].join("\r\n");
};
function zip(files: { name: string; data: string }[]) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), raw = Buffer.from(f.data, "utf8"), packed = deflateRawSync(raw), crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0); h.writeUInt16LE(20,4); h.writeUInt16LE(0x0800,6); h.writeUInt16LE(8,8); h.writeUInt32LE(crc,14); h.writeUInt32LE(packed.length,18); h.writeUInt32LE(raw.length,22); h.writeUInt16LE(name.length,26);
    local.push(h,name,packed);
    const d = Buffer.alloc(46); d.writeUInt32LE(0x02014b50,0); d.writeUInt16LE(20,4); d.writeUInt16LE(20,6); d.writeUInt16LE(0x0800,8); d.writeUInt16LE(8,10); d.writeUInt32LE(crc,16); d.writeUInt32LE(packed.length,20); d.writeUInt32LE(raw.length,24); d.writeUInt16LE(name.length,28); d.writeUInt32LE(offset,42);
    central.push(d,name); offset += h.length + name.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(cd.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,cd,end]);
}
async function rows(q: any) {
  const all: any[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? [])); if ((data ?? []).length < 1000) break;
  }
  const { data: overflow, error } = await q.range(10000, 10000);
  if (error) throw new Error(error.message);
  if ((overflow ?? []).length) throw new Error("Narrow the filters to export at most 10,000 records per source.");
  return all;
}
export async function GET(req: Request) {
  const url = new URL(req.url), month = url.searchParams.get("month") ?? "", branch = url.searchParams.get("branch") ?? "all";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  const start = `${month}-01`, [year, m] = month.split("-").map(Number), end = new Date(Date.UTC(year, m, 1)).toISOString().slice(0,10);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (branch !== "all" && !UUID.test(branch)) return NextResponse.json({ error: "Choose a valid branch." }, { status: 400 });
  const sb = supabaseServer(), { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: allowed } = await sb.rpc("has_perm", { p: "finance_view" });
  if (!allowed) return NextResponse.json({ error: "Finance export permission is required." }, { status: 403 });
  if (branch !== "all") { const { data: can } = await sb.rpc("can_access_branch", { b: branch }); if (!can) return NextResponse.json({ error: "You cannot export that branch." }, { status: 403 }); }
  try {
    let salesQ = sb.from("sales").select("id,code,created_at,branch_id,kind,status,grand_total,taxable_total,cgst_total,sgst_total,igst_total,supply_type,payment_status,paid_total,customers!sales_customer_id_fkey(full_name,gstin,state,state_code),sale_lines(line_no,line_type,description,qty,unit_price,discount_pct,line_total,taxable_value,cgst_pct,cgst_amt,sgst_pct,sgst_amt,igst_pct,igst_amt,hsn)").eq("kind","order").neq("status","cancelled").gte("created_at",`${start}T00:00:00`).lt("created_at",`${end}T00:00:00`).order("created_at");
    let purchasesQ = sb.from("purchase_invoices").select("id,branch_id,supplier_name,supplier_gstin,invoice_no,invoice_date,supply_type,subtotal,tax_total,grand_total,cgst_total,sgst_total,igst_total,status,paid_amount,paid_on,created_at,purchase_items(description,hsn,qty,unit_price,tax_pct,taxable_value,cgst_amt,sgst_amt,igst_amt,line_total)").gte("invoice_date",start).lt("invoice_date",end).order("invoice_date");
    let expenseQ = sb.from("expenses").select("branch_id,expense_date,category,description,amount,payment_method,reference,created_by").gte("expense_date",start).lt("expense_date",end).order("expense_date");
    let cashQ = sb.from("cashbook").select("branch_id,occurred_on,direction,source,category,party,doc_code,reference,method,amount,memo,sale_id").gte("occurred_on",start).lt("occurred_on",end).order("occurred_on");
    if (branch !== "all") { salesQ=salesQ.eq("branch_id",branch); purchasesQ=purchasesQ.eq("branch_id",branch); expenseQ=expenseQ.eq("branch_id",branch); cashQ=cashQ.eq("branch_id",branch); }
    const [sales, purchases, expenses, cashbook, branchRows] = await Promise.all([
      rows(salesQ), rows(purchasesQ), rows(expenseQ), rows(cashQ), rows(sb.from("branches").select("id,name")),
    ]);
    const branchName = (id: string) => branchRows.find(b => b.id === id)?.name ?? "";
    const saleRows = sales.map((s: any) => ({ date:s.created_at, invoice:s.code, branch:branchName(s.branch_id), customer:s.customers?.full_name, gstin:s.customers?.gstin, place_of_supply:s.customers?.state, supply_type:s.supply_type, taxable:s.taxable_total, cgst:s.cgst_total, sgst:s.sgst_total, igst:s.igst_total, total:s.grand_total, paid:s.paid_total, payment_status:s.payment_status }));
    const gstr = sales.flatMap((s: any) => (s.sale_lines ?? []).map((l:any) => ({ invoice:s.code, invoice_date:s.created_at, customer:s.customers?.full_name, recipient_gstin:s.customers?.gstin, place_of_supply:s.customers?.state_code ?? s.customers?.state, supply_type:s.supply_type, hsn:l.hsn, description:l.description, qty:l.qty, taxable_value:l.taxable_value, cgst_pct:l.cgst_pct, cgst_amt:l.cgst_amt, sgst_pct:l.sgst_pct, sgst_amt:l.sgst_amt, igst_pct:l.igst_pct, igst_amt:l.igst_amt, line_total:l.line_total })));
    const purchaseRows = purchases.flatMap((p: any) => {
      const common = { invoice: p.invoice_no, invoice_date: p.invoice_date, branch: branchName(p.branch_id), supplier: p.supplier_name, supplier_gstin: p.supplier_gstin, supply_type: p.supply_type, paid_amount: p.paid_amount, payment_status: p.status };
      if ((p.purchase_items ?? []).length) return p.purchase_items.map((l: any) => ({ ...common, hsn: l.hsn, description: l.description, qty: l.qty, taxable_value: l.taxable_value, cgst_amt: l.cgst_amt, sgst_amt: l.sgst_amt, igst_amt: l.igst_amt, line_total: l.line_total }));
      return [{ ...common, subtotal: p.subtotal, tax_total: p.tax_total, grand_total: p.grand_total, cgst_total: p.cgst_total, sgst_total: p.sgst_total, igst_total: p.igst_total }];
    });
    const files = [
      { name:"sales.csv", rows:saleRows, cols:["date","invoice","branch","customer","gstin","place_of_supply","supply_type","taxable","cgst","sgst","igst","total","paid","payment_status"] },
      { name:"purchases.csv", rows:purchaseRows, cols:["invoice","invoice_date","branch","supplier","supplier_gstin","supply_type","hsn","description","qty","taxable_value","cgst_amt","sgst_amt","igst_amt","line_total","paid_amount","payment_status","subtotal","tax_total","grand_total","cgst_total","sgst_total","igst_total"] },
      { name:"gstr1_outward_detail.csv", rows:gstr, cols:["invoice","invoice_date","customer","recipient_gstin","place_of_supply","supply_type","hsn","description","qty","taxable_value","cgst_pct","cgst_amt","sgst_pct","sgst_amt","igst_pct","igst_amt","line_total"] },
      { name:"gst_input_credit.csv", rows:purchaseRows, cols:["invoice","invoice_date","branch","supplier","supplier_gstin","supply_type","hsn","description","qty","taxable_value","cgst_amt","sgst_amt","igst_amt","line_total"] },
      { name:"cashbook.csv", rows:cashbook.map((r:any)=>({...r,branch:branchName(r.branch_id)})), cols:["occurred_on","branch","direction","source","category","party","doc_code","reference","method","amount","memo","sale_id"] },
      { name:"expenses.csv", rows:expenses.map((r:any)=>({...r,branch:branchName(r.branch_id)})), cols:["expense_date","branch","category","description","amount","payment_method","reference","created_by"] },
    ].map(f => ({ name:f.name, data:csv(f.rows,f.cols) }));
    await sb.rpc("log_export", { p_kind:"accountant_bundle", p_rows:sales.length+purchases.length+expenses.length+cashbook.length, p_detail:{ month, branch } });
    return new NextResponse(zip(files), { headers:{ "Content-Type":"application/zip", "Content-Disposition":`attachment; filename="poweros-accountant-${month}.zip"`, "Cache-Control":"no-store" } });
  } catch (e: any) {
    console.error("Accountant export failed", e?.message);
    return NextResponse.json({ error: "Could not build the export. Check access and try again." }, { status: 503 });
  }
}
