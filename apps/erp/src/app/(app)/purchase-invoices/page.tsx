import { supabaseServer } from "@/lib/supabase/server";
import { PurchaseInvoicesView } from "./view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Invoices – PowerOS Finance" };

export default async function Page() {
  const sb = supabaseServer();
  const [{ data: invoices }, { data: suppliers }, { data: branches }, { data: products }, { data: itcSummary }] = await Promise.all([
    sb.from("purchase_invoices")
      .select("id,invoice_no,invoice_date,due_date,po_ref,supply_type,supplier_name,supplier_gstin,supplier_id,branch_id,lines,subtotal,taxable_value,cgst_amount,sgst_amount,igst_amount,grand_total,paid_amount,payment_date,payment_mode,payment_ref,itc_eligible,itc_claimed,itc_claim_period,gstr2a_matched,status,notes,stock_posted_at,created_at")
      .order("invoice_date", { ascending: false })
      .limit(500),
    sb.from("suppliers")
      .select("id,name,gstin,state,address,phone,email,contact_person,status")
      .eq("status", "active")
      .order("name"),
    sb.from("branches")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    sb.from("products")
      .select("id,sku,model,brands(name)")
      .eq("status", "active")
      .order("model"),
    sb.from("itc_summary")
      .select("period,invoice_count,total_purchases,eligible_cgst,eligible_sgst,eligible_igst,total_itc,claimed_itc")
      .order("period", { ascending: false })
      .limit(24),
  ]);

  return (
    <PurchaseInvoicesView
      invoices={invoices ?? []}
      suppliers={suppliers ?? []}
      branches={branches ?? []}
      products={products ?? []}
      itcSummary={itcSummary ?? []}
    />
  );
}
