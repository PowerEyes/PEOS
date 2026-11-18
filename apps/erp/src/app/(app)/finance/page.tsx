import { supabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { FinanceView } from "./view";
export default async function Page() {
  const sb = supabaseServer(); const settings = await getSettings();
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  const monthStart = new Date(y, m, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(y, m + 1, 1).toISOString().slice(0, 10);
  const todayStart = new Date(y, m, now.getDate()).toISOString().slice(0, 10);
  const [{ data: salesMonth }, { data: salesToday }, { data: outstanding }, { data: expenses }, { data: purchasesMonth }, { data: branches }, { data: days30 }, { data: creditNotes }, { data: gstPeriods }] = await Promise.all([
    sb.from("sales").select("grand_total, cgst_total, sgst_total, igst_total, taxable_total").eq("kind","order").neq("status","cancelled").gte("created_at",monthStart).lt("created_at",monthEnd),
    sb.from("sales").select("grand_total").eq("kind","order").neq("status","cancelled").gte("created_at",todayStart),
    sb.from("sales").select("id, code, grand_total, paid_total, created_at, customers(full_name)").eq("kind","order").neq("status","cancelled").eq("payment_status","unpaid").order("created_at",{ascending:false}).limit(50),
    sb.from("expenses").select("*").gte("expense_date",monthStart).lt("expense_date",monthEnd).order("expense_date",{ascending:false}),
    sb.from("purchase_invoices").select("cgst_total, sgst_total, igst_total").gte("invoice_date",monthStart).lt("invoice_date",monthEnd),
    sb.from("branches").select("id,name").eq("is_active",true).order("name"),
    sb.from("sales").select("created_at, grand_total").eq("kind","order").neq("status","cancelled").gte("created_at", new Date(Date.now()-30*86400000).toISOString()).order("created_at"),
    sb.from("credit_notes").select("*, credit_note_lines(*), customers(full_name)").order("created_at",{ascending:false}).limit(50),
    sb.from("gst_periods").select("*").order("period_year",{ascending:false}).order("period_month",{ascending:false}).limit(24)]);
  return <FinanceView settings={settings} salesMonth={salesMonth??[]} salesToday={salesToday??[]} outstanding={outstanding??[]} expenses={expenses??[]} purchasesMonth={purchasesMonth??[]} branches={branches??[]} days30={days30??[]} creditNotes={creditNotes??[]} gstPeriods={gstPeriods??[]} />;
}
