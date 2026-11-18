
"use client";
import { useState } from "react";
import { FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { getGSTR1Data } from "./actions";
import { toCSV, downloadCSV } from "@/lib/csv";

const inr = (n:any) => `₹${Number(n||0).toLocaleString("en-IN")}`;

export default function GSTR1Page() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // prev month
  const [busy,  setBusy]  = useState(false);
  const [data,  setData]  = useState<any>(null);
  const [err,   setErr]   = useState("");

  async function fetch() {
    setBusy(true); setErr(""); setData(null);
    try {
      const d = await getGSTR1Data(year, month);
      setData(d);
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  }

  function exportSection(rows: any[], name: string) {
    if (!rows.length) { alert(`No ${name} records for this period.`); return; }
    downloadCSV(toCSV(rows), `GSTR1-${name}-${String(month).padStart(2,"0")}-${year}.csv`);
  }

  function exportAll() {
    if (!data) return;
    // Export each section as separate CSV tabs concatenated
    const sections = [
      { name:"B2B",  rows:data.b2b },
      { name:"B2CS", rows:data.b2cs },
      { name:"B2CL", rows:data.b2cl },
      { name:"HSN",  rows:data.hsn },
      { name:"DOCS", rows:data.docs },
    ];
    for (const s of sections) {
      if (s.rows.length > 0) exportSection(s.rows, s.name);
    }
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText size={20}/>GSTR-1 Export</h1>
      </div>

      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex gap-3">
        <AlertCircle size={18} className="shrink-0 mt-0.5"/>
        <div>
          <p className="font-semibold">Government Format Export</p>
          <p className="mt-1">This generates GSTR-1 Section CSVs (B2B, B2CS, B2CL, HSN Summary, Document Summary) compatible with the GST Offline Tool. Verify before filing. Due date: 11th of the following month.</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
        <p className="font-semibold text-slate-700">Select Return Period</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Month</p>
            <div className="flex gap-1 flex-wrap">
              {MONTHS.map((m,i) => (
                <button key={m} onClick={() => setMonth(i+1)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${month===i+1?"bg-navy-800 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {m}
                </button>))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Year</p>
            <div className="flex gap-1">
              {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => (
                <button key={y} onClick={() => setYear(y)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${year===y?"bg-navy-800 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {y}
                </button>))}
            </div>
          </div>
          <button onClick={fetch} disabled={busy || !month}
            className="rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition disabled:opacity-60">
            {busy ? "Fetching…" : `Fetch ${month ? MONTHS[month-1] : ""} ${year}`}
          </button>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600"/>
              <div>
                <p className="font-bold text-emerald-900">GSTR-1 data ready for {data.period}</p>
                <p className="text-xs text-emerald-700">{data.totalInvoices} invoices · GSTIN: {data.org?.gstin ?? "Not set"}</p>
              </div>
            </div>
            <button onClick={exportAll} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition">
              <Download size={15}/>Export All Sections
            </button>
          </div>

          {/* Section cards */}
          {[
            { key:"b2b",  label:"B2B — Registered Recipients",          desc:"Invoices issued to businesses with GSTIN",     color:"blue" },
            { key:"b2cs", label:"B2CS — B2C Small",                     desc:"Retail invoices ≤ ₹2,50,000 (aggregated)",     color:"green" },
            { key:"b2cl", label:"B2CL — B2C Large",                     desc:"Retail invoices > ₹2,50,000 (line by line)",   color:"amber" },
            { key:"hsn",  label:"HSN — HSN/SAC Summary",                desc:"All supplies summarised by HSN code",           color:"violet" },
            { key:"docs", label:"DOCS — Document Summary",              desc:"Count of invoices, debit and credit notes",     color:"slate" },
          ].map(s => {
            const rows = data[s.key] ?? [];
            const colorMap: Record<string,string> = { blue:"bg-blue-50 border-blue-100 text-blue-800", green:"bg-emerald-50 border-emerald-100 text-emerald-800", amber:"bg-amber-50 border-amber-100 text-amber-800", violet:"bg-violet-50 border-violet-100 text-violet-800", slate:"bg-slate-50 border-slate-100 text-slate-700" };
            return (
              <div key={s.key} className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className={`flex items-center justify-between px-5 py-3.5 border-b border-slate-100 ${colorMap[s.color]}`}>
                  <div>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-xs opacity-70">{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{rows.length} records</span>
                    <button onClick={() => exportSection(rows, s.key.toUpperCase())} disabled={!rows.length}
                      className="flex items-center gap-1.5 rounded-lg bg-white/60 border border-current/20 px-3 py-1.5 text-xs font-bold hover:bg-white transition disabled:opacity-40">
                      <Download size={12}/>CSV
                    </button>
                  </div>
                </div>
                {rows.length > 0 && (
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-50 border-b border-slate-100">
                        {Object.keys(rows[0]).map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>)}
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0,10).map((r:any,i:number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {Object.values(r).map((v:any,j:number) => <td key={j} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{String(v ?? "")}</td>)}
                          </tr>))}
                        {rows.length > 10 && <tr><td colSpan={Object.keys(rows[0]).length} className="px-3 py-2 text-xs text-slate-400 text-center">…and {rows.length-10} more rows in the CSV</td></tr>}
                      </tbody>
                    </table>
                  </div>)}
              </div>);})}

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            ⚠️ Always verify the exported data against your original invoices before filing. Upload the CSV files using the GST Offline Tool available at gstn.org.in. IGST applies on interstate sales; CGST+SGST applies on intrastate sales.
          </div>
        </div>)}
    </div>);
}
