
"use server";
import { supabaseServer } from "@/lib/supabase/server";

const ORG = "00000000-0000-0000-0000-000000000001";

export async function getGSTR1Data(year: number, month: number) {
  const sb   = supabaseServer();
  const from = `${year}-${String(month).padStart(2,"0")}-01`;
  const to   = new Date(year, month, 0).toISOString().slice(0,10);

  // Org GSTIN
  const { data: org } = await sb.from("organizations").select("gstin,name,state_code").eq("id",ORG).single();

  // All invoices for the period
  const { data: sales } = await sb.from("sales")
    .select(`id,code,created_at,grand_total,taxable_total,cgst_total,sgst_total,igst_total,supply_type,
      customers!sales_customer_id_fkey(full_name,gstin,state_code,city,state),
      sale_lines(description,qty,line_total,taxable_value,cgst_pct,sgst_pct,igst_pct,cgst_amt,sgst_amt,igst_amt,products(hsn,model))`)
    .gte("created_at", from+"T00:00:00").lte("created_at", to+"T23:59:59")
    .eq("kind","order").neq("status","cancelled").order("created_at");

  if (!sales) return { org, b2b:[], b2cs:[], b2cl:[], hsn:[], docs:[] };

  const b2b:  any[] = [];  // Registered customers (have GSTIN)
  const b2cl: any[] = [];  // Unregistered, invoice > ₹2,50,000
  const b2cs: any[] = [];  // Unregistered, invoice ≤ ₹2,50,000

  for (const sale of sales) {
    const c   = (sale.customers as any);
    const lines = (sale.sale_lines as any[]) ?? [];
    const taxable = Number(sale.taxable_total ?? sale.grand_total);
    const cgst    = Number(sale.cgst_total ?? 0);
    const sgst    = Number(sale.sgst_total ?? 0);
    const igst    = Number(sale.igst_total ?? 0);
    const supply  = sale.supply_type ?? "intrastate";
    const dateStr = new Date(sale.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});
    const stateCode = c?.state_code ?? "33"; // Default Tamil Nadu

    if (c?.gstin) {
      // B2B
      b2b.push({
        "GSTIN/UIN of Recipient": c.gstin,
        "Receiver Name":          c.full_name,
        "Invoice Number":         sale.code,
        "Invoice Date":           dateStr,
        "Invoice Value":          Number(sale.grand_total).toFixed(2),
        "Place Of Supply":        stateCode,
        "Reverse Charge":         "N",
        "Invoice Type":           "Regular",
        "Applicable % of Tax Rate": "",
        "Rate":                   supply==="interstate" ? "5" : "5",
        "Taxable Value":          taxable.toFixed(2),
        "Integrated Tax Amount":  supply==="interstate" ? igst.toFixed(2) : "",
        "Central Tax Amount":     supply==="intrastate" ? cgst.toFixed(2) : "",
        "State/UT Tax Amount":    supply==="intrastate" ? sgst.toFixed(2) : "",
        "Cess Amount":            "0",
      });
    } else if (Number(sale.grand_total) > 250000) {
      // B2CL
      b2cl.push({
        "Invoice Number":        sale.code,
        "Invoice Date":          dateStr,
        "Invoice Value":         Number(sale.grand_total).toFixed(2),
        "Place Of Supply":       stateCode,
        "Applicable % of Tax Rate":"",
        "Rate":                  "5",
        "Taxable Value":         taxable.toFixed(2),
        "Integrated Tax Amount": igst.toFixed(2),
        "Cess Amount":           "0",
      });
    } else {
      // B2CS — aggregate by state + rate
      const key  = `${stateCode}-5`;
      const exist = b2cs.find(r => r._key === key);
      if (exist) {
        exist["Taxable Value"] = (Number(exist["Taxable Value"]) + taxable).toFixed(2);
        exist["Integrated Tax Amount"] = (Number(exist["Integrated Tax Amount"]||0) + igst).toFixed(2);
        exist["Central Tax Amount"]    = (Number(exist["Central Tax Amount"]||0)    + cgst).toFixed(2);
        exist["State/UT Tax Amount"]   = (Number(exist["State/UT Tax Amount"]||0)   + sgst).toFixed(2);
      } else {
        b2cs.push({
          _key: key,
          "Type":                      "OE",
          "Place Of Supply":           stateCode,
          "Applicable % of Tax Rate":  "",
          "Rate":                      "5",
          "Taxable Value":             taxable.toFixed(2),
          "Integrated Tax Amount":     igst.toFixed(2),
          "Central Tax Amount":        cgst.toFixed(2),
          "State/UT Tax Amount":       sgst.toFixed(2),
          "Cess Amount":               "0",
        });
      }
    }
  }

  // B2CS — remove internal _key before export
  const b2csClean = b2cs.map(({ _key, ...rest }) => rest);

  // HSN Summary — aggregate by HSN code
  const hsnMap: Record<string, any> = {};
  for (const sale of sales) {
    for (const line of ((sale.sale_lines as any[]) ?? [])) {
      const hsn  = (line.products as any)?.hsn ?? "9004";
      const desc = (line.products as any)?.model ?? line.description ?? "";
      const key  = hsn;
      if (!hsnMap[key]) {
        hsnMap[key] = { "HSN Code":hsn, "Description":desc, "UOM":"NOS", "Total Quantity":0, "Total Value":0, "Taxable Value":0, "Integrated Tax Amount":0, "Central Tax Amount":0, "State/UT Tax Amount":0, "Cess Amount":0 };
      }
      hsnMap[key]["Total Quantity"]         += Number(line.qty ?? 1);
      hsnMap[key]["Total Value"]            += Number(line.line_total ?? 0);
      hsnMap[key]["Taxable Value"]          += Number(line.taxable_value ?? line.line_total ?? 0);
      hsnMap[key]["Integrated Tax Amount"]  += Number(line.igst_amt ?? 0);
      hsnMap[key]["Central Tax Amount"]     += Number(line.cgst_amt ?? 0);
      hsnMap[key]["State/UT Tax Amount"]    += Number(line.sgst_amt ?? 0);
    }
  }
  const hsn = Object.values(hsnMap).map(r => ({
    ...r,
    "Total Value":           r["Total Value"].toFixed(2),
    "Taxable Value":         r["Taxable Value"].toFixed(2),
    "Integrated Tax Amount": r["Integrated Tax Amount"].toFixed(2),
    "Central Tax Amount":    r["Central Tax Amount"].toFixed(2),
    "State/UT Tax Amount":   r["State/UT Tax Amount"].toFixed(2),
  }));

  // Document summary
  const docs = [{ "Nature of Document":"Invoices for outward supply","Sr. No. From":sales[0]?.code ?? "","Sr. No. To":sales[sales.length-1]?.code ?? "","Total Number":sales.length,"Cancelled":0 }];

  return { org, b2b, b2cs:b2csClean, b2cl, hsn, docs, period:`${String(month).padStart(2,"0")}/${year}`, totalInvoices:sales.length };
}
