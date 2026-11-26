
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Calendar, Download } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Preset = { label:string; from:string; to:string };

function getPresets(fyMonth:number): Preset[] {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth(); // 0-indexed

  const pad  = (n:number) => String(n).padStart(2,"0");
  const fy   = (d:Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const monthStart = (year:number, month:number) => fy(new Date(year,month,1));
  const monthEnd   = (year:number, month:number) => fy(new Date(year,month+1,0));

  const qtr = Math.floor(m/3);
  const qtrStart = [0,3,6,9][qtr];

  const fyStartYear=m>=fyMonth-1?y:y-1;
  const fyStart=monthStart(fyStartYear,fyMonth-1),fyEnd=monthEnd(fyStartYear+1,fyMonth-2);
  const lastFyStart=monthStart(fyStartYear-1,fyMonth-1),lastFyEnd=monthEnd(fyStartYear,fyMonth-2);
  return [
    { label:"Today",         from:fy(now),                        to:fy(now) },
    { label:"This Week",     from:fy(new Date(now.getFullYear(),now.getMonth(),now.getDate()-now.getDay())), to:fy(now) },
    { label:"This Month",    from:monthStart(y,m),                to:monthEnd(y,m) },
    { label:"Last Month",    from:monthStart(y,m-1),              to:monthEnd(y,m-1) },
    { label:"This Quarter",  from:monthStart(y,qtrStart),         to:monthEnd(y,qtrStart+2) },
    { label:"Last Quarter",  from:monthStart(y,qtrStart-3),       to:monthEnd(y,qtrStart-1) },
    { label:"This Financial Year", from:fyStart, to:fyEnd },
    { label:"Last Financial Year", from:lastFyStart, to:lastFyEnd },
  ];
}

type Props = {
  exportLabel?: string;
  onExport?: (from:string, to:string) => Promise<void>;
  exportLoading?: boolean;
};

export function DateRangeFilter({ exportLabel="Export CSV", onExport, exportLoading }: Props) {
  const router = useRouter();
  const path   = usePathname();
  const sp     = useSearchParams();
  const [,start] = useTransition();
  const [fyMonth,setFyMonth]=useState(4);
  useEffect(()=>{supabaseBrowser().from("organizations").select("financial_year_start_month").maybeSingle().then(({data})=>{if(data?.financial_year_start_month)setFyMonth(Number(data.financial_year_start_month));});},[]);
  const presets    = getPresets(fyMonth);
  const thisMonth  = presets[2];
  const activeFrom = sp.get("from") ?? thisMonth.from;
  const activeTo   = sp.get("to")   ?? thisMonth.to;

  const activePreset = presets.find(p => p.from===activeFrom && p.to===activeTo)?.label;

  const [customFrom, setCustomFrom] = useState(activeFrom);
  const [customTo,   setCustomTo]   = useState(activeTo);

  function apply(from:string, to:string) {
    start(() => {
      const q = new URLSearchParams(sp.toString());
      q.set("from", from); q.set("to", to);
      router.push(`${path}?${q.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {presets.map(p => (
          <button key={p.label} onClick={() => apply(p.from, p.to)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${activePreset===p.label?"bg-navy-800 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {p.label}
          </button>))}
      </div>
      {/* Custom range */}
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
        <Calendar size={13} className="text-slate-400 shrink-0"/>
        <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="border-none outline-none text-xs text-slate-700 bg-transparent"/>
        <span className="text-slate-300">→</span>
        <input type="date" value={customTo}   onChange={e=>setCustomTo(e.target.value)}   className="border-none outline-none text-xs text-slate-700 bg-transparent"/>
        <button onClick={()=>apply(customFrom,customTo)}
          className="rounded-lg bg-navy-800 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-navy-700 transition">
          Apply
        </button>
      </div>
      {/* Export */}
      {onExport && (
        <button onClick={() => onExport(activeFrom, activeTo)} disabled={exportLoading}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60">
          <Download size={13}/>{exportLoading ? "Exporting…" : exportLabel}
        </button>)}
    </div>);
}
