"use client";
import { useTransition } from "react";
import { Store } from "lucide-react";
import { setBranchScope } from "@/app/(app)/scope-actions";
/** Which branch's numbers the dashboard shows. Read access to customers is org-wide regardless; editing is limited by the database. */
export function BranchSwitcher({ branches, scope }: { branches: { id: string; name: string }[]; scope: string | null }) {
  const [pending, start] = useTransition();
  if (branches.length < 2) return null;
  return (<label className={`flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-2.5 pr-1 text-xs ${pending ? "opacity-60" : ""}`}>
    <Store size={13} className="text-navy-700" /><span className="sr-only">Branch</span>
    <select value={scope ?? "all"} disabled={pending} onChange={(e) => start(() => setBranchScope(e.target.value))} className="max-w-[9.5rem] rounded-full bg-transparent py-1 pr-1 font-semibold text-navy-900 outline-none">
      <option value="all">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>);
}
