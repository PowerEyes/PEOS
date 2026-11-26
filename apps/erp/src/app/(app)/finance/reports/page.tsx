"use client";
import { useScope } from "@/components/ScopeContext";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DateRangeFilter } from "../date-range-filter";
import { toCSV, downloadCSV, formatDate } from "@/lib/csv";
import { TrendingUp, ShoppingBag, CreditCard, AlertCircle } from "lucide-react";

const inr = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

type Sale = {
  id:string; code:string; status:string; payment_status:string;
  grand_total:number; paid_total:number; gst_applied:boolean;
  created_at:string; kind:string;
  customers?: { full_name:string; phone:string } | null;
};

function ReportsContent() {
  const sp   = useSearchParams();
  const scope = useScope();
  const now  = new Date();
  const defFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const defTo   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,"0")}`;
  const from = sp.get("from") ?? defFrom;
  const to   = sp.get("to")   ?? defTo;

  const [sales,    setSales]    = useState<Sale[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [exporting,setExporting]= useState(false);

  useEffect(() => {
    setLoading(true);
    supabaseBrowser()
      .from("sales")
      .select("id,code,status,payment_status,grand_total,paid_total,gst_applied,created_at,kind,customers!sales_customer_id_fkey(full_name,phone)")
      .gte("created_at", from + "T00:00:00")
      .lte("created_at", to   + "T23:59:59")
      .in("kind",["order","quotation"])
      .match(scope ? { branch_id: scope } : {})
      .order("created_at",{ascending:false})
      .limit(500)
      .then(({ data }) => { setSales((data ?? []) as unknown as Sale[]); setLoading(false); });
  }, [from, to, scope]);

  async function handleExport(f:string, t:string) {
    setExporting(true);
    const { data } = await supabaseBrowser()
      .from("sales")
      .select("code,kind,status,payment_status,grand_total,paid_total,gst_applied,created_at,customers!sales_customer_id_fkey(full_name,phone)")
      .gte("created_at", f+"T00:00:00").lte("created_at", t+"T23:59:59")
      .match(scope ? { branch_id: scope } : {})
      .order("created_at",{ascending:false}).limit(2000);
    const rows = (data ?? []).map((s:any) => ({
      "Invoice No":        s.code,
      "Type":              s.kind,
      "Date":              formatDate(s.created_at),
      "Customer":          s.customers?.full_name ?? "",
      "Phone":             s.customers?.phone ?? "",
      "Status":            s.status,
      "Payment":           s.payment_status,
      "Total":             s.grand_total,
      "Paid":              s.paid_total,
      "Balance":           Number(s.grand_total) - Number(s.paid_total),
      "GST Applied":       s.gst_applied ? "Yes" : "No",
    }));
    downloadCSV(toCSV(rows), `sales-report-${f}-to-${t}.csv`);
    setExporting(false);
  }

  // KPIs
  const confirmed  = sales.filter(s => !["cancelled","draft"].includes(s.status));
  const totalRev   = confirmed.reduce((a,s) => a + Number(s.grand_total), 0);
  const totalPaid  = confirmed.reduce((a,s) => a + Number(s.paid_total), 0);
  const outstanding= totalRev - totalPaid;
  const orderCount = confirmed.filter(s => s.kind==="order").length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={20}/>Sales Report</h1>
      </div>

      <DateRangeFilter exportLabel="Export CSV" onExport={handleExport} exportLoading={exporting}/>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Total Revenue",   value:inr(totalRev),   icon:TrendingUp,  cls:"bg-blue-50 text-blue-700 border-blue-100" },
          { label:"Amount Collected",value:inr(totalPaid),  icon:CreditCard,  cls:"bg-emerald-50 text-emerald-700 border-emerald-100" },
          { label:"Outstanding",     value:inr(outstanding),icon:AlertCircle, cls:"bg-amber-50 text-amber-700 border-amber-100" },
          { label:"Orders",          value:orderCount,       icon:ShoppingBag, cls:"bg-violet-50 text-violet-700 border-violet-100" },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.cls}`}>
            <k.icon size={18} className="mb-2"/>
            <p className="font-extrabold text-2xl">{k.value}</p>
            <p className="text-xs font-medium mt-0.5">{k.label}</p>
          </div>))}
      </div>

      {/* Sales table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {loading
          ? <div className="p-10 text-center text-slate-400">Loading…</div>
          : sales.length === 0
            ? <div className="p-10 text-center text-slate-400">No sales in this period.</div>
            : <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    {["Date","Invoice","Customer","Type","Status","Payment","Total","Paid","Balance"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left">{h}</th>))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map(s => {
                      const bal = Number(s.grand_total) - Number(s.paid_total);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(s.created_at)}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-navy-900">{s.code}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{s.customers?.full_name ?? "Walk-in"}</p>
                            {s.customers?.phone && <p className="text-xs text-slate-400">{s.customers.phone}</p>}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-xs">{s.kind}</td>
                          <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                            s.status==="delivered"?"bg-emerald-100 text-emerald-700":s.status==="cancelled"?"bg-rose-100 text-rose-600":"bg-amber-100 text-amber-700"}`}>{s.status}</span></td>
                          <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${s.payment_status==="paid"?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{s.payment_status}</span></td>
                          <td className="px-4 py-2.5 font-semibold text-right">{inr(s.grand_total)}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-600">{inr(s.paid_total)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${bal>0?"text-amber-600":"text-slate-400"}`}>{bal>0?inr(bal):"—"}</td>
                        </tr>);})}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-sm">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-slate-600">Total ({confirmed.length} sales)</td>
                      <td className="px-4 py-3 text-right">{inr(totalRev)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{inr(totalPaid)}</td>
                      <td className={`px-4 py-3 text-right ${outstanding>0?"text-amber-600":"text-slate-400"}`}>{outstanding>0?inr(outstanding):"—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>}
      </div>
    </div>);
}

export default function ReportsPage() {
  const scope = useScope();
  return <Suspense fallback={<div className="p-10 text-center text-slate-400">Loading…</div>}><ReportsContent/></Suspense>;
}
