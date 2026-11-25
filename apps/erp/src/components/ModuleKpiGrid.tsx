import React from "react";
import { TrendingUp, Users, Package, AlertTriangle, Clock, CheckCircle2, IndianRupee, Activity } from "lucide-react";

export type ModuleKpi = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: React.ReactNode;
};
const tone = {
  default: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  warning: "border-amber-200 bg-amber-50/70 text-amber-950",
  danger: "border-rose-200 bg-rose-50/70 text-rose-950",
  info: "border-blue-200 bg-blue-50/70 text-blue-950",
};
export function ModuleKpiGrid({ items, className = "" }: { items: ModuleKpi[]; className?: string }) {
  return <section aria-label="Module overview metrics" className={`grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
    {items.map((item) => <article key={item.label} className={`min-w-0 rounded-2xl border p-3.5 sm:p-4 ${tone[item.tone ?? "default"]}`}>
      <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium opacity-75">{item.label}</p><span className="shrink-0 opacity-70">{item.icon ?? <Activity size={16}/>}</span></div>
      <p className="mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl" title={String(item.value)}>{item.value}</p>
      {item.detail && <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-75">{item.detail}</p>}
    </article>)}
  </section>;
}
export const KPIIcons = { users: <Users size={16}/>, package: <Package size={16}/>, warning: <AlertTriangle size={16}/>, clock: <Clock size={16}/>, check: <CheckCircle2 size={16}/>, money: <IndianRupee size={16}/>, trend: <TrendingUp size={16}/> };
