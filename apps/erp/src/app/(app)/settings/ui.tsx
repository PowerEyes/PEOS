"use client";
import type { ReactNode } from "react";

export const Switch = ({ on, set, label, hint, disabled }: {
  on: boolean; set: (v: boolean) => void; label: string; hint?: string; disabled?: boolean;
}) => (
  <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => !disabled && set(!on)}
    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:bg-slate-50 disabled:opacity-60">
    <span><span className="block font-medium">{label}</span>{hint && <span className="block text-sm text-slate-500">{hint}</span>}</span>
    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-gold-500" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
  </button>);

export const L = ({ t, children, hint }: { t: string; children: ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-600">{t}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
  </label>);

export function SectionCard({ title, icon: Icon, children, footer }: {
  title: string; icon: any; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon size={16} />{title}</div>
      {children}
      {footer}
    </div>);
}
