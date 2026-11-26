const tones = {
  green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", gold: "bg-amber-50 text-amber-700",
  red: "bg-rose-50 text-rose-600", purple: "bg-violet-50 text-violet-700", grey: "bg-slate-100 text-slate-600",
};
export function Pill({ tone = "grey", children, className = "" }: { tone?: keyof typeof tones; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>{children}</span>;
}
