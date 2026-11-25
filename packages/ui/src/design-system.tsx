import React from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({ variant = "primary", size = "md", className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-navy-800 text-white hover:bg-navy-700 focus-visible:ring-navy-500",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400",
    ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500",
  };
  const sizes = { sm: "min-h-8 px-3 text-xs", md: "min-h-10 px-4 text-sm", lg: "min-h-11 px-5 text-sm" };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}>{children}</button>;
}

export function Card({ title, description, actions, children, className = "", padding = "md" }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padding?: "none" | "sm" | "md" | "lg" }) {
  const pads = { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" };
  return <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}>
    {(title || description || actions) && <header className={`flex flex-wrap items-start justify-between gap-3 ${padding === "none" ? "p-4" : pads[padding]} ${children ? "pb-3" : ""}`}>
      <div className="min-w-0"><h2 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>}</div>{actions}
    </header>}
    <div className={pads[padding]}>{children}</div>
  </section>;
}

export function PageHeader({ title, description, eyebrow, actions, meta, className = "" }: { title: React.ReactNode; description?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode; className?: string }) {
  return <header className={`mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between ${className}`}>
    <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2">{eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">{eyebrow}</span>}{meta}</div><h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl lg:text-[28px]">{title}</h1>{description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
  </header>;
}

const badgeStyles = { neutral: "bg-slate-100 text-slate-700 ring-slate-200", info: "bg-blue-50 text-blue-700 ring-blue-100", success: "bg-emerald-50 text-emerald-700 ring-emerald-100", warning: "bg-amber-50 text-amber-800 ring-amber-100", danger: "bg-rose-50 text-rose-700 ring-rose-100", purple: "bg-violet-50 text-violet-700 ring-violet-100" };
export function StatusBadge({ status, tone = "neutral", className = "" }: { status: React.ReactNode; tone?: keyof typeof badgeStyles; className?: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badgeStyles[tone]} ${className}`}>{status}</span>;
}

export function LoadingState({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return <div role="status" aria-live="polite" className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 ${className}`}><Loader2 className="animate-spin text-navy-700" size={22} /><span>{label}</span></div>;
}
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500">{icon ?? <Info size={20}/>}</div><h3 className="text-sm font-semibold text-slate-800">{title}</h3>{description && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function ErrorState({ title = "Something went wrong", description = "We couldn't load this information. Try again.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return <div role="alert" className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-5 py-7 text-center"><AlertCircle size={22} className="mb-2 text-rose-600"/><h3 className="text-sm font-semibold text-rose-900">{title}</h3><p className="mt-1 max-w-md text-xs leading-5 text-rose-700">{description}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw size={14}/> Retry</button>}</div>;
}
export function Notice({ tone = "info", title, children, className = "" }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children: React.ReactNode; className?: string }) {
  const styles = { info: "border-blue-200 bg-blue-50 text-blue-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900", warning: "border-amber-200 bg-amber-50 text-amber-950", danger: "border-rose-200 bg-rose-50 text-rose-900" };
  const icons = { info: <Info size={17}/>, success: <CheckCircle2 size={17}/>, warning: <AlertCircle size={17}/>, danger: <AlertCircle size={17}/> };
  return <div role="status" className={`flex gap-3 rounded-xl border p-3.5 ${styles[tone]} ${className}`}><span className="mt-0.5 shrink-0">{icons[tone]}</span><div className="min-w-0"><div className="text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs leading-5 opacity-90">{children}</div></div></div>;
}
export function Field({ label, hint, error, required, children, className = "" }: { label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><label className="block text-sm font-medium text-slate-700">{label}{required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}</label>{children}{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}</div>;
}
